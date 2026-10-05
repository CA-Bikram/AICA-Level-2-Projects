"""Submission-readiness checks; not a legal validity determination."""
import re
from drafting import parse_date, compute_delay

def validate_export(data, docs=()):
    errors = []
    if not data.get('service_date') or not parse_date(data.get('service_date')):
        errors.append('Enter the actual service date in DD/MM/YYYY format.')
    if data.get('service_confirmed') != 'Yes':
        errors.append('Confirm the service date in Reference data after checking the record.')
    if data.get('drafts_reviewed') != 'Yes':
        errors.append('Review the facts, grounds and figures, then confirm review in Reference data.')
    for key in ('pan','assessment_year'):
        seen = {d.values[key] for d in docs if d.values.get(key)}
        if len(seen)>1:
            errors.append(f'{key.upper()} differs across documents. Remove the incorrect document.')
    for key in ('statement_of_facts','grounds_of_appeal','condonation_grounds'):
        value = data.get(key)
        if re.search(r'\[CONFIRM:|\[state the reason|_{4,}',value,re.I):
            errors.append(f'Resolve placeholders in {key.replace("_"," ")}.')
    if not parse_date(data.get('verification_date')):
        errors.append('Enter a valid verification / intended filing date.')
    delay = compute_delay(data)
    if delay is not None and delay > 0 and not data.get('condonation_grounds').strip():
        errors.append('A late appeal needs a case-specific condonation draft for review.')
    facts = data.get('statement_of_facts')
    grounds = data.get('grounds_of_appeal')
    if not facts.strip() or len(facts.split())>1000:
        errors.append('Statement of facts must be present and within 1000 words.')
    if not grounds.strip() or any(len(g.split())>100 for g in re.split(r'\n\s*\n|\n(?=\s*\d+[.)]\s)',grounds) if g.strip()):
        errors.append('Grounds must be present and each within 100 words.')
    if len(data.get('condonation_grounds').split())>500:
        errors.append('Condonation grounds exceed 500 words.')
    return errors
