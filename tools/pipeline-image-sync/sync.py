#!/usr/bin/env python3
"""Dry-run by default. Copy digest-verified pipeline images over Harbor LAN TLS."""
import argparse, base64, getpass, hashlib, json, os, re, shutil, subprocess, sys, tempfile, time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'lib'))
from registry_lan_route import LanConnectProxy, validate_auth_file
ROOT=Path(__file__).resolve().parent
REDACTIONS=[]

class Progress:
    def __init__(self,total,stream=None,clock=time.monotonic):
        self.total=total; self.stream=stream or sys.stdout; self.clock=clock
        self.started=clock(); self.completed=0; self.current=''; self.phase=''
        self.last=-100; self.frame=0
    def begin(self,name,phase):
        self.current=name; self.phase=phase; self.last=-100; self.tick()
    def tick(self):
        now=self.clock(); tty=self.stream.isatty()
        if now-self.last < (0.2 if tty else 15): return
        self.last=now
        width=20; filled=width*self.completed//self.total
        bar='#'*filled+'-'*(width-filled)
        elapsed=int(now-self.started); mins,secs=divmod(elapsed,60)
        marker='|/-\\'[self.frame%4]; self.frame+=1
        line=f"{marker} [{bar}] {self.completed}/{self.total} ({100*self.completed//self.total:3}%)  {self.current} — {self.phase}  {mins:02}:{secs:02}"
        print(('\r\033[2K' if tty else '')+line,end='' if tty else '\n',file=self.stream,flush=True)
    def done(self):
        if self.stream.isatty(): print('\r\033[2K',end='',file=self.stream)
        self.completed+=1
        print(f"  ✓ [{self.completed}/{self.total}] {self.current} — synced and verified",file=self.stream,flush=True)
    def finish(self):
        elapsed=int(self.clock()-self.started); mins,secs=divmod(elapsed,60)
        print(f"\nComplete: {self.completed}/{self.total} images verified · {mins}m {secs}s",file=self.stream,flush=True)

def run(args,env,progress=None):
    p=subprocess.Popen(['skopeo',*args],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        while True:
            try:
                stdout,stderr=p.communicate(timeout=0.2); break
            except subprocess.TimeoutExpired:
                if progress: progress.tick()
    except BaseException:
        p.terminate()
        try:p.communicate(timeout=5)
        except subprocess.TimeoutExpired:p.kill();p.communicate()
        raise
    if p.returncode:
        if progress and progress.stream.isatty(): print(file=progress.stream)
        message=stderr.decode(errors='replace').strip()
        for value in REDACTIONS:
            if value: message=message.replace(value,'[REDACTED]')
        message=re.sub(r'(?i)(authorization|password|token|secret)([=: ]+)[^\s,]+',r'\1\2[REDACTED]',message)
        label=f"{progress.current}: " if progress else ''
        raise RuntimeError(f"{label}{args[0]} failed: {message[-1800:]}")
    return stdout

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--apply',action='store_true')
    ap.add_argument('--dry-run',action='store_true')
    ap.add_argument('--only',help='Validate/sync one named component')
    ap.add_argument('--auth-file',type=Path,default=Path.home()/'.config/ajrly-harbor-sync/auth.json')
    ap.add_argument('--init-auth',action='store_true')
    a=ap.parse_args()
    if a.dry_run: a.apply=False
    if a.init_auth:
        if a.auth_file.exists(): raise ValueError('auth file already exists; move it explicitly before replacement')
        a.auth_file.parent.mkdir(parents=True,exist_ok=True)
        username=input('Harbor mirror-project robot username: ').strip()
        password=getpass.getpass('Harbor robot secret (hidden): ')
        value=base64.b64encode(f'{username}:{password}'.encode()).decode()
        fd=os.open(a.auth_file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w') as f:json.dump({'auths':{'harbor.ajrly.com':{'auth':value}}},f)
        print('Private auth file created. No Keychain or Docker login changed.')
        return
    catalog=json.loads((ROOT/'images.json').read_text())
    entries=[i for i in catalog['images'] if not a.only or i['component']==a.only]
    if not entries: raise ValueError('unknown component')
    print(f"{'Syncing' if a.apply else 'Preview:'} {len(entries)} pipeline images to Harbor mirror\n")
    for number,i in enumerate(entries,1):
        if not re.fullmatch(r'sha256:[0-9a-f]{64}',i['digest']):raise ValueError('invalid digest')
        if not i['target'].startswith('harbor.ajrly.com/mirror/'):raise ValueError('out-of-scope destination')
        name,version=i["source"].rsplit(":",1)
        print(f"  {number:2}. {name.removeprefix('docker.io/library/').removeprefix('docker.io/'):<40} {version}")
    if not a.apply:
        print(f'{len(entries)} pinned images. No network requests or changes.')
        return
    if not shutil.which('skopeo'):raise ValueError('Install skopeo first: brew install skopeo')
    with tempfile.TemporaryDirectory(prefix='ajrly-image-sync-') as tmp:
        route=Path(tmp)/'routes.json';route.write_text(json.dumps({'harbor.ajrly.com':'192.168.68.40'}))
        # Local operator-authorized authentication, temporary file only; targets restricted to mirror.
        print('Loading local Harbor authentication automatically...',flush=True)
        result=subprocess.run(['kubectl','-n','artifacts','get','secret','harbor-admin','-o','json'],capture_output=True)
        if result.returncode: raise ValueError('Cannot read local Harbor credentials with current kubectl context')
        secret=base64.b64decode(json.loads(result.stdout)['data']['HARBOR_ADMIN_PASSWORD']).decode()
        username='admin'
        encoded=base64.b64encode(f'{username}:{secret}'.encode()).decode()
        REDACTIONS.extend([secret,encoded])
        auth_file=Path(tmp)/'auth.json'
        fd=os.open(auth_file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w') as f:json.dump({'auths':{'harbor.ajrly.com':{'auth':encoded}}},f)
        proxy=LanConnectProxy(route,auth_file)
        try:
            env={k:v for k,v in os.environ.items() if k.lower() not in ('https_proxy','http_proxy','all_proxy','no_proxy')}
            env.update(proxy.proxy_env())
            progress=Progress(len(entries))
            for i in entries:
                source=i['source'].split('@')[0]
                repo=source.rsplit(':',1)[0]
                pinned=f'docker://{repo}@{i["digest"]}'
                progress.begin(i['source'].removeprefix('docker.io/library/').removeprefix('docker.io/'),'Checking source')
                raw=run(['inspect','--raw',pinned],env,progress)
                if 'sha256:'+hashlib.sha256(raw).hexdigest()!=i['digest']:raise ValueError('source digest mismatch')
                tag='sha256-'+i['digest'][7:]
                dest=f'docker://{i["target"]}:{tag}'
                progress.begin(progress.current,'Transferring layers')
                run(['copy','--all','--preserve-digests','--dest-authfile',str(auth_file),pinned,dest],env,progress)
                progress.begin(progress.current,'Verifying Harbor digest')
                raw=run(['inspect','--raw','--authfile',str(auth_file),dest],env,progress)
                if 'sha256:'+hashlib.sha256(raw).hexdigest()!=i['digest']:raise ValueError('destination digest mismatch')
                progress.done()
        finally:proxy.close()
    held=[] if a.only else catalog.get('held',[])
    if held:
        print(f"INCOMPLETE: {len(entries)} verified images synced, but required components remain unresolved:",file=sys.stderr)
        for item in held: print(' - '+item['component']+': '+item['reason'],file=sys.stderr)
        raise RuntimeError('The full agreed image set has NOT been mirrored. See unresolved components above.')
    progress.finish()

if __name__=='__main__':
    try:main()
    except KeyboardInterrupt:
        print('\nSync canceled.',file=sys.stderr);sys.exit(130)
    except (ValueError,RuntimeError,OSError) as e:
        print('STOP:',str(e),file=sys.stderr);sys.exit(1)
