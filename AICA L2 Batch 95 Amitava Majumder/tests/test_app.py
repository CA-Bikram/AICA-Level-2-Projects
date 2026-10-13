import csv
import io
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from datetime import date, timedelta
from urllib.request import Request, urlopen
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import Store, progress, csv_export, Handler, ThreadingHTTPServer


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.store=Store(Path(self.tmp.name)/'test.sqlite3')
        self.store.save_client({'name':'Test Client','email':'test@example.com','contact':'Alex'})
        self.cid=self.store.state()['clients'][0]['id']
        self.request={'client_id':self.cid,'document':'Bank statement','service':'Audit',
                      'period':'September 2026','due_date':'2026-10-03','status':'Pending'}

    def tearDown(self):
        self.tmp.cleanup()

    def test_date_boundaries(self):
        today=date(2026,10,4)
        self.assertEqual(progress('Pending','2026-10-03',today),'Overdue')
        self.assertEqual(progress('Pending','2026-10-04',today),'Due today')
        self.assertEqual(progress('Pending','2026-10-05',today),'Upcoming')

    def test_closed_items_never_overdue(self):
        for status in ('Received','Not required'):
            self.assertEqual(progress(status,'2020-01-01',date(2026,10,4)),status)

    def test_invalid_calendar_date_rejected(self):
        with self.assertRaises(ValueError): self.store.save_request({**self.request,'due_date':'2026-02-30'})

    def test_blank_fields_rejected(self):
        for field in ('document','period'):
            with self.assertRaises(ValueError): self.store.save_request({**self.request,field:'  '})

    def test_unknown_client_rejected(self):
        with self.assertRaises(ValueError): self.store.save_request({**self.request,'client_id':999})

    def test_invalid_status_rejected(self):
        with self.assertRaises(ValueError): self.store.save_request({**self.request,'status':'Overdue'})

    def test_duplicate_client_rejected(self):
        with self.assertRaises(ValueError): self.store.save_client({'name':'test client'})

    def test_persistence(self):
        self.store.save_request(self.request)
        reopened=Store(self.store.path)
        self.assertEqual(reopened.state()['requests'][0]['document'],'Bank statement')

    def test_backup_restores_all_records(self):
        self.store.save_request(self.request)
        snapshot=Path(self.tmp.name)/'restored.sqlite3'
        snapshot.write_bytes(self.store.backup())
        restored=Store(snapshot)
        self.assertEqual(restored.state(),self.store.state())
        with restored.connect() as db:
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0],'ok')

    def test_backup_is_independent_of_later_changes(self):
        snapshot=self.store.backup()
        self.store.save_request(self.request)
        path=Path(self.tmp.name)/'earlier.sqlite3';path.write_bytes(snapshot)
        self.assertEqual(Store(path).state()['requests'],[])
        self.assertEqual(len(self.store.state()['requests']),1)

    def test_received_date_preserved_and_cleared(self):
        self.store.save_request({**self.request,'status':'Received'})
        r=self.store.state()['requests'][0]
        self.assertEqual(r['received_date'],date.today().isoformat())
        with self.store.connect() as db:db.execute("UPDATE requests SET received_date='2026-01-02'")
        self.store.save_request({**r,'notes':'Updated'})
        self.assertEqual(self.store.state()['requests'][0]['received_date'],'2026-01-02')
        self.store.save_request({**r,'status':'Pending'})
        self.assertIsNone(self.store.state()['requests'][0]['received_date'])

    def test_reminder_excludes_closed_items(self):
        self.store.save_request(self.request)
        for status in ('Received','Not required'):
            self.store.save_request({**self.request,'document':status+' document','status':status})
        draft=self.store.reminder({'client_id':self.cid})
        self.assertIn('Bank statement',draft['body'])
        self.assertNotIn('Received document',draft['body'])
        self.assertNotIn('Not required document',draft['body'])

    def test_no_pending_reminder_rejected(self):
        with self.assertRaises(ValueError):self.store.reminder({'client_id':self.cid})

    def test_demo_cannot_overwrite(self):
        with self.assertRaises(ValueError):self.store.seed()
        self.assertEqual(len(self.store.state()['clients']),1)

    def test_demo_counts_and_due_dates(self):
        s=Store(Path(self.tmp.name)/'demo.sqlite3');s.seed();state=s.state()
        self.assertEqual(len(state['clients']),3)
        self.assertEqual(len(state['requests']),8)
        self.assertEqual(sum(r['timing']=='Overdue' for r in state['requests']),2)
        self.assertEqual(sum(r['status']=='Received' for r in state['requests']),2)

    def test_delete_missing_rejected(self):
        with self.assertRaises(ValueError):self.store.delete_request({'id':999})

    def test_delete_does_not_delete_client(self):
        self.store.save_request(self.request)
        self.store.delete_request({'id':self.store.state()['requests'][0]['id']})
        self.assertEqual(len(self.store.state()['requests']),0)
        self.assertEqual(len(self.store.state()['clients']),1)

    def test_csv_formula_and_quoted_text(self):
        self.store.save_request({**self.request,'document':'=SUM(1,2)','notes':'Quoted "note", second\nline'})
        output=csv_export(self.store.state()['requests']).decode('utf-8-sig')
        rows=list(csv.reader(io.StringIO(output)))
        self.assertEqual(rows[1][2],"'=SUM(1,2)")
        self.assertEqual(rows[1][-1],'Quoted "note", second\nline')


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        cls.server.store=Store(Path(cls.tmp.name)/'http.sqlite3')
        cls.server.token='test-token'
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
        cls.base='http://127.0.0.1:'+str(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join();cls.tmp.cleanup()

    def test_home_and_assets(self):
        with urlopen(self.base) as r:
            content=r.read().decode();self.assertIn('test-token',content);self.assertNotIn('__TOKEN__',content)
        for path in ('/app.js','/style.css','/api/state'):
            with urlopen(self.base+path) as r:self.assertEqual(r.status,200)

    def test_missing_token_rejected(self):
        with self.assertRaises(HTTPError) as ctx:urlopen(Request(self.base+'/api/demo',data=b'{}'))
        self.assertEqual(ctx.exception.code,403)

    def test_backup_download(self):
        with urlopen(Request(self.base+'/api/backup',data=b'{}',headers={'X-CDRT-Token':'test-token'})) as r:
            self.assertIn('.sqlite3',r.headers['Content-Disposition'])
            self.assertTrue(r.read().startswith(b'SQLite format 3\x00'))

    def test_backup_without_token_rejected(self):
        with self.assertRaises(HTTPError) as ctx:urlopen(Request(self.base+'/api/backup',data=b'{}'))
        self.assertEqual(ctx.exception.code,403)

    def test_host_guard(self):
        with self.assertRaises(HTTPError) as ctx:urlopen(Request(self.base,headers={'Host':'evil.example'}))
        self.assertEqual(ctx.exception.code,403)

    def test_http_create_and_export(self):
        headers={'Content-Type':'application/json','X-CDRT-Token':'test-token'}
        data=json.dumps({'name':'HTTP client'}).encode()
        with urlopen(Request(self.base+'/api/client',data=data,headers=headers)) as r:self.assertEqual(r.status,200)
        with urlopen(self.base+'/api/state') as r:cid=json.load(r)['clients'][0]['id']
        payload={'client_id':cid,'document':'Invoices','service':'Audit','period':'FY 2026','due_date':'2026-10-04'}
        with urlopen(Request(self.base+'/api/request',data=json.dumps(payload).encode(),headers=headers)) as r:self.assertEqual(r.status,200)
        with urlopen(self.base+'/api/state') as r:rid=json.load(r)['requests'][0]['id']
        with urlopen(Request(self.base+'/api/export',data=json.dumps({'ids':[rid]}).encode(),headers=headers)) as r:self.assertIn('Invoices',r.read().decode('utf-8-sig'))

    def test_malformed_json(self):
        with self.assertRaises(HTTPError) as ctx:urlopen(Request(self.base+'/api/client',data=b'{',headers={'X-CDRT-Token':'test-token'}))
        self.assertEqual(ctx.exception.code,400)


if __name__=='__main__':unittest.main()
