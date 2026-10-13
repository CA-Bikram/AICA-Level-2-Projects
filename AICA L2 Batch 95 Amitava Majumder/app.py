"""CDRT: a local, single-user document request tracker. Python 3.10+; no packages."""
import argparse
import csv
import io
import json
import secrets
import sqlite3
import threading
import tempfile
import webbrowser
from contextlib import contextmanager
from datetime import date, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
SERVICES = ('Bookkeeping', 'Audit', 'Tax preparation', 'Other')
STATUSES = ('Pending', 'Received', 'Not required')


def required(value, label, limit=200):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'{label} is required.')
    value = value.strip()
    if len(value) > limit:
        raise ValueError(f'{label} must be {limit} characters or fewer.')
    return value


def optional(value, label, limit=2000):
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError(f'{label} must be text of {limit} characters or fewer.')
    return value.strip()


def day(value):
    try:
        if not isinstance(value, str) or len(value) != 10:
            raise ValueError()
        result = date.fromisoformat(value)
        if result.isoformat() != value:
            raise ValueError()
        return result
    except (ValueError, TypeError):
        raise ValueError('Enter a valid due date in YYYY-MM-DD format.') from None


def identifier(value):
    if type(value) is not int or value < 1:
        raise ValueError('A valid record ID is required.')
    return value


def progress(status, due_date, today=None):
    today = today or date.today()
    if status != 'Pending':
        return status
    delta = (day(due_date) - today).days
    return 'Overdue' if delta < 0 else 'Due today' if delta == 0 else 'Upcoming'


class Store:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS clients (
                    id INTEGER PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    email TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT ''
                );
                CREATE TABLE IF NOT EXISTS requests (
                    id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id),
                    document TEXT NOT NULL, service TEXT NOT NULL, period TEXT NOT NULL,
                    due_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pending',
                    notes TEXT NOT NULL DEFAULT '', received_date TEXT,
                    created_date TEXT NOT NULL
                );
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        try:
            with db:
                yield db
        finally:
            db.close()

    def state(self, today=None):
        today = today or date.today()
        with self.connect() as db:
            clients = [dict(r) for r in db.execute('SELECT * FROM clients ORDER BY name')]
            rows = [dict(r) for r in db.execute('''SELECT r.*, c.name AS client_name,
                c.email AS client_email FROM requests r JOIN clients c ON c.id=r.client_id
                ORDER BY r.due_date, c.name, r.id''')]
        for row in rows:
            row['timing'] = progress(row['status'], row['due_date'], today)
            row['days_overdue'] = max(0, (today-day(row['due_date'])).days) if row['status']=='Pending' else 0
        return {'clients': clients, 'requests': rows, 'today': today.isoformat()}

    def save_client(self, data):
        name = required(data.get('name'), 'Client name', 100)
        email = optional(data.get('email', ''), 'Email', 254)
        if email and (email.count('@') != 1 or any(c.isspace() for c in email) or not all(email.split('@'))):
            raise ValueError('Enter a valid email address, or leave it blank.')
        contact = optional(data.get('contact', ''), 'Contact person', 100)
        with self.connect() as db:
            try:
                if data.get('id') is not None:
                    result = db.execute('UPDATE clients SET name=?,email=?,contact=? WHERE id=?',
                                        (name,email,contact,identifier(data['id'])))
                    if result.rowcount != 1:
                        raise ValueError('Client no longer exists. Refresh and try again.')
                else:
                    db.execute('INSERT INTO clients(name,email,contact) VALUES(?,?,?)',(name,email,contact))
            except sqlite3.IntegrityError:
                raise ValueError('A client with this name already exists.') from None

    def backup(self):
        """Use SQLite's backup API for a consistent snapshot while the app runs."""
        with tempfile.TemporaryDirectory(prefix='cdrt-backup-') as folder:
            snapshot = Path(folder)/'cdrt.sqlite3'
            target = sqlite3.connect(snapshot)
            try:
                with self.connect() as source:
                    source.backup(target)
            finally:
                target.close()
            return snapshot.read_bytes()

    def save_request(self, data):
        client = identifier(data.get('client_id'))
        document = required(data.get('document'), 'Document name', 150)
        period = required(data.get('period'), 'Period / reference', 100)
        service = data.get('service')
        status = data.get('status', 'Pending')
        if service not in SERVICES or status not in STATUSES:
            raise ValueError('Choose a listed service and status.')
        due = day(data.get('due_date')).isoformat()
        notes = optional(data.get('notes',''), 'Notes')
        today = date.today().isoformat()
        with self.connect() as db:
            if not db.execute('SELECT id FROM clients WHERE id=?',(client,)).fetchone():
                raise ValueError('Select an existing client.')
            rid = data.get('id')
            old = None
            if rid is not None:
                old = db.execute('SELECT * FROM requests WHERE id=?',(identifier(rid),)).fetchone()
                if old is None:
                    raise ValueError('Request no longer exists. Refresh and try again.')
            received = (old['received_date'] if old and old['status']=='Received' else today) if status=='Received' else None
            values = (client,document,service,period,due,status,notes,received)
            if old:
                db.execute('''UPDATE requests SET client_id=?,document=?,service=?,period=?,due_date=?,
                    status=?,notes=?,received_date=? WHERE id=?''', values+(rid,))
            else:
                db.execute('''INSERT INTO requests(client_id,document,service,period,due_date,status,
                    notes,received_date,created_date) VALUES(?,?,?,?,?,?,?,?,?)''', values+(today,))

    def delete_request(self, data):
        with self.connect() as db:
            result = db.execute('DELETE FROM requests WHERE id=?',(identifier(data.get('id')),))
            if result.rowcount != 1:
                raise ValueError('Request no longer exists.')

    def seed(self):
        """Only seed an empty database. Never overwrite the user's records."""
        today = date.today()
        with self.connect() as db:
            if db.execute('SELECT COUNT(*) FROM clients').fetchone()[0] or db.execute('SELECT COUNT(*) FROM requests').fetchone()[0]:
                raise ValueError('Sample data can only be loaded into an empty tracker.')
            for name,email,contact in [('ABC Traders (Demo)','accounts@abc.example','Anita'),
                                       ('Northstar Services (Demo)','finance@northstar.example','Rahul'),
                                       ('Maple Studio (Demo)','hello@maple.example','Maya')]:
                db.execute('INSERT INTO clients(name,email,contact) VALUES(?,?,?)',(name,email,contact))
            clients = [r[0] for r in db.execute('SELECT id FROM clients ORDER BY id')]
            examples=[(0,'Bank statement','Bookkeeping',-5,'Pending'),
                      (0,'Sales invoices','Bookkeeping',-5,'Received'),
                      (0,'Purchase invoices','Bookkeeping',0,'Pending'),
                      (1,'Fixed asset register','Audit',-2,'Pending'),
                      (1,'Inventory summary','Audit',3,'Pending'),
                      (1,'Loan statements','Audit',-2,'Not required'),
                      (2,'Expense receipts','Bookkeeping',7,'Pending'),
                      (2,'Bank statement','Bookkeeping',7,'Received')]
            period = (today.replace(day=1)-timedelta(days=1)).strftime('%B %Y')
            for c,document,service,offset,status in examples:
                db.execute('''INSERT INTO requests(client_id,document,service,period,due_date,status,
                    notes,received_date,created_date) VALUES(?,?,?,?,?,?,?,?,?)''',
                    (clients[c],document,service,period,(today+timedelta(days=offset)).isoformat(),
                     status,'Fictional sample for demonstration.',today.isoformat() if status=='Received' else None,today.isoformat()))

    def reminder(self, data):
        cid = identifier(data.get('client_id'))
        state = self.state()
        client = next((c for c in state['clients'] if c['id']==cid), None)
        if not client:
            raise ValueError('Select a client.')
        rows = [r for r in state['requests'] if r['client_id']==cid and r['status']=='Pending']
        if not rows:
            raise ValueError('This client has no pending documents.')
        tone = data.get('tone','Polite')
        if tone not in ('Polite','Follow-up','Firm'):
            raise ValueError('Select a reminder tone.')
        lead = {'Polite':'Please share the following pending documents:',
                'Follow-up':'Following up on our document requests. These items are still pending:',
                'Firm':'The following documents remain pending. Please prioritise overdue items and confirm when you can provide them.'}[tone]
        items = '\n'.join(f"- {r['document']} | {r['period']} | Due: {r['due_date']}"+
                          (f" ({r['days_overdue']} days overdue)" if r['days_overdue'] else '') for r in rows)
        body = f"Dear {client['contact'] or client['name']},\n\n{lead}\n\n{items}\n\nIf you have already shared an item, please let us know so we can update our records.\n\nThank you,\nYour Accounts Team"
        return {'to':client['email'],'subject':f"Pending documents - {client['name']}",'body':body}


def csv_export(rows):
    stream = io.StringIO(newline='')
    writer = csv.writer(stream)
    fields = [('id','Request ID'),('client_name','Client'),('document','Document'),('service','Service'),
              ('period','Period / reference'),('due_date','Due date'),('status','Status'),('timing','Timing'),
              ('days_overdue','Days overdue'),('received_date','Received date'),('notes','Notes')]
    writer.writerow([label for key,label in fields])
    for row in rows:
        values = []
        for key,label in fields:
            value = str(row.get(key) if row.get(key) is not None else '')
            # Keep user-entered text from becoming a formula when opened in Excel.
            if value.lstrip().startswith(('=','+','-','@')) or value.startswith(('\t','\r','\n')):
                value = "'"+value
            values.append(value)
        writer.writerow(values)
    return ('\ufeff'+stream.getvalue()).encode('utf-8')


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send(self, status, payload, content_type='application/json; charset=utf-8', filename=None):
        if not isinstance(payload, bytes):
            payload = json.dumps(payload,ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type',content_type)
        self.send_header('Content-Length',str(len(payload)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('X-Frame-Options','DENY')
        self.send_header('Referrer-Policy','no-referrer')
        self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'")
        if filename:
            self.send_header('Content-Disposition',f'attachment; filename="{filename}"')
        self.end_headers()
        self.wfile.write(payload)

    def allowed_host(self):
        return self.headers.get('Host') in (f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}')

    def do_GET(self):
        if not self.allowed_host():
            return self.send(403,{'error':'Local access only.'})
        path = urlparse(self.path).path
        if path == '/':
            html = (ROOT/'static'/'index.html').read_text(encoding='utf-8').replace('__TOKEN__',self.server.token)
            return self.send(200,html.encode('utf-8'),'text/html; charset=utf-8')
        if path in ('/app.js','/style.css'):
            ct = 'text/javascript' if path.endswith('.js') else 'text/css'
            return self.send(200,(ROOT/'static'/path[1:]).read_bytes(),ct+'; charset=utf-8')
        if path=='/api/state':
            return self.send(200,self.server.store.state())
        return self.send(404,{'error':'Page not found.'})

    def do_POST(self):
        if not self.allowed_host() or self.headers.get('X-CDRT-Token') != self.server.token:
            return self.send(403,{'error':'Session expired. Refresh this page.'})
        try:
            size = int(self.headers.get('Content-Length','0'))
            if size < 1 or size > 100_000:
                raise ValueError('The request is empty or too large.')
            data = json.loads(self.rfile.read(size))
            if not isinstance(data,dict):
                raise ValueError('Expected a JSON object.')
            path = urlparse(self.path).path
            store = self.server.store
            actions = {'/api/client':store.save_client,'/api/request':store.save_request,
                       '/api/delete':store.delete_request}
            if path in actions:
                actions[path](data)
            elif path=='/api/demo':
                store.seed()
            elif path=='/api/reminder':
                return self.send(200,store.reminder(data))
            elif path=='/api/backup':
                return self.send(200,store.backup(),'application/octet-stream',
                                 f'CDRT-backup-{date.today().isoformat()}.sqlite3')
            elif path=='/api/export':
                ids=data.get('ids')
                if not isinstance(ids,list) or any(type(i) is not int for i in ids):
                    raise ValueError('Select valid requests to export.')
                selected_ids=set(ids)
                rows=[r for r in store.state()['requests'] if r['id'] in selected_ids]
                return self.send(200,csv_export(rows),'text/csv; charset=utf-8','CDRT-document-status.csv')
            else:
                return self.send(404,{'error':'Action not found.'})
            return self.send(200,{'ok':True})
        except (ValueError, UnicodeDecodeError) as exc:
            return self.send(400,{'error':str(exc)})
        except sqlite3.Error:
            return self.send(500,{'error':'Could not save data. Please try again.'})


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=8765)
    parser.add_argument('--db',type=Path,default=ROOT/'data'/'cdrt.sqlite3')
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    try:
        server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    except OSError:
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    server.store=Store(args.db)
    server.token=secrets.token_urlsafe(32)
    address=f'http://127.0.0.1:{server.server_port}'
    print(f'CDRT is ready: {address}\nData: {args.db}\nKeep this window open. Press Ctrl+C to stop.',flush=True)
    if not args.no_browser:
        threading.Timer(0.6,lambda:webbrowser.open(address)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__=='__main__':
    main()
