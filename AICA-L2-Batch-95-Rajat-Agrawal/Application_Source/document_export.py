"""Separate editable narrative exports; avoid accidental overwrites."""
from pathlib import Path
import re
from datetime import datetime

def export_narratives(data, folder):
    folder = Path(folder)
    stem = re.sub(r'[^A-Za-z0-9_-]','_',data.get('pan') or 'case')
    target = folder / f'Appeal_{stem}_{datetime.now():%Y%m%d_%H%M%S_%f}'
    target.mkdir()
    output=[]
    for key,title in [('statement_of_facts','Statement of Facts'),('grounds_of_appeal','Grounds of Appeal'),('condonation_grounds','Condonation of Delay')]:
        if data.get(key).strip():
            path=target/(key+'.txt')
            path.write_text(f'{title}\n{data.assessee_name} | AY {data.get("assessment_year")}\n\n{data.get(key)}\n',encoding='utf-8')
            output.append(str(path))
    return output
