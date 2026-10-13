import unittest
from unittest.mock import patch
from types import SimpleNamespace
from datetime import date
import json
from data_models import AppealData
import drafting, ai_client
from validation import validate_export

class Improvements(unittest.TestCase):
    def data(self):
        d=AppealData()
        for k,v in {'last_name':'Demo Taxpayer','pan':'ABCDE1234F','assessment_year':'2024-25','order_date':'01/01/2026','order_section':'143(3)','income_assessed':'8,00,000','returned_income':'6,00,000','addition_details':'Expense disallowance | 2,00,000'}.items():d.set(k,v)
        return d
    def test_no_assumed_service(self):
        d=self.data();drafting.apply_drafts(d,{},today=date(2026,1,2))
        self.assertEqual(d.get('service_date'),'');self.assertEqual(d.get('delay'),'')
    def test_keywords_are_not_facts(self):
        d=self.data();h={'_flags':'NONCOMPLIANCE,ADJOURNMENT,44AD,44ADA,194J'}
        self.assertNotIn('request was not acceded',drafting.draft_facts(d,h))
        self.assertNotIn('notified',drafting.draft_grounds(d,h))
        self.assertNotIn('notices u/s 143(2) and 142(1) were issued',drafting.draft_facts(d,h))
    def test_conflicts_block(self):
        docs=[SimpleNamespace(values={'pan':'ABCDE1234F'}),SimpleNamespace(values={'pan':'AAAAA0000A'})]
        self.assertTrue(any('differs' in x for x in validate_export(self.data(),docs)))
    def test_limits_and_placeholders(self):
        d=self.data();d.set('statement_of_facts','[CONFIRM: missing]');d.set('grounds_of_appeal','word '*101)
        errors=validate_export(d)
        self.assertTrue(any('placeholders' in x for x in errors));self.assertTrue(any('100 words' in x for x in errors))
    def test_model_output_checked(self):
        with self.assertRaises(ValueError):ai_client.validate_result({'statement_of_facts':'fact','grounds_of_appeal':['word '*101],'review_notes':'check'})
    def test_ai_request_and_remote_block(self):
        d=self.data();docs=[SimpleNamespace(text='[PAGE 1]\nFictional expense disallowance.')]
        result={'statement_of_facts':'1. The order records an expense disallowance.','grounds_of_appeal':['The appellant disputes the expense disallowance.'],'review_notes':'Check DOC-1 PAGE 1.'}
        with patch('ai_client.request',side_effect=[{'details':{'parameter_size':'8B'}},{'message':{'content':json.dumps(result)},'done':True}]) as req:
            out=ai_client.generate(d,docs,'demo:8b');self.assertIn('1.',out['grounds_of_appeal'])
            self.assertEqual(req.call_args_list[1].args[0],'/api/chat')
        with patch('ai_client.request',return_value={'remote_host':'example','details':{'parameter_size':'8B'}}):
            with self.assertRaises(ValueError):ai_client.generate(d,docs,'demo:8b')
    def test_no_silent_truncation(self):
        with self.assertRaises(ValueError):ai_client.build_input(self.data(),[SimpleNamespace(text='x'*50000)])
    def test_review_preserved_on_generate(self):
        d=self.data();d.set('statement_of_facts','Reviewer draft','Edited by user');drafting.apply_drafts(d,{})
        self.assertEqual(d.get('statement_of_facts'),'Reviewer draft')

if __name__=='__main__':unittest.main()
