import contextlib,importlib.util,io,json,os,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('sync',Path(__file__).with_name('sync.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Checks(unittest.TestCase):
 def test_dry_run_never_calls_registry(self):
  with patch('sys.argv',['sync.py']),patch.object(m,'run',side_effect=AssertionError('network')),contextlib.redirect_stdout(io.StringIO()) as out:m.main()
  self.assertIn('No network requests',out.getvalue())
 def test_catalog_pipeline_scope_and_single_components(self):
  x=json.loads((m.ROOT/'images.json').read_text());components=[i['component'] for i in x['images']]
  self.assertEqual(len(components),len(set(components)))
  self.assertFalse(any('postgres' in i['source'] or 'argocd' in i['source'] for i in x['images']))
  for i in x['images']:self.assertRegex(i['digest'],r'^sha256:[0-9a-f]{64}$')
 def test_auth_created_private_without_overwrite(self):
  with tempfile.TemporaryDirectory() as t:
   p=Path(t)/'auth.json'
   with patch('sys.argv',['sync.py','--init-auth','--auth-file',str(p)]),patch('builtins.input',return_value='robot$mirror+sync'),patch.object(m.getpass,'getpass',return_value='test-only'),contextlib.redirect_stdout(io.StringIO()):m.main()
   self.assertEqual(p.stat().st_mode&0o777,0o600)
   with patch('sys.argv',['sync.py','--init-auth','--auth-file',str(p)]):
    with self.assertRaises(ValueError):m.main()
if __name__=='__main__':unittest.main()

class ProgressChecks(unittest.TestCase):
 def test_progress_counts_only_verified_images(self):
  out=io.StringIO();p=m.Progress(2,stream=out,clock=lambda:0)
  p.begin('node','Checking source');p.begin('node','Transferring layers')
  self.assertEqual(p.completed,0)
  p.done();p.begin('alpine','Checking source')
  self.assertIn('1/2 ( 50%)',out.getvalue())
  self.assertNotIn('100%',out.getvalue())
  p.done();p.finish();self.assertIn('Complete: 2/2',out.getvalue())
 def test_log_output_is_throttled(self):
  now=[0];out=io.StringIO();p=m.Progress(1,stream=out,clock=lambda:now[0])
  p.begin('node','Transferring layers')
  for second in range(1,15):now[0]=second;p.tick()
  self.assertEqual(len(out.getvalue().splitlines()),1)
  now[0]=15;p.tick();self.assertEqual(len(out.getvalue().splitlines()),2)
