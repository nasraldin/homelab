#!/usr/bin/env python3
"""Preview or apply the missing local homelab host mappings. No passwords stored."""
import argparse
import difflib
import os
from pathlib import Path
import shutil
import subprocess
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
p = Path('/etc/hosts')
before = p.read_text()
after = before.replace('pve01.lab.nasraldin.com', 'pve01.lab.ajrly.app')
entries = [("192.168.68.40", name) for name in ['autensa.lab', 'dify.lab', 'hermes.lab', 'paperclip.lab']]
entries.append(('192.168.68.10', 'pve01.lab.ajrly.app'))
known = {name for line in after.splitlines() if not line.lstrip().startswith('#') for name in line.split('#', 1)[0].split()[1:]}
missing = [(ip, name) for ip, name in entries if name not in known]
if missing:
    after = after.rstrip() + '\n\n# Additional homelab aliases (ajrly.app migration)\n'
    after += ''.join(ip + ' ' + name + '\n' for ip, name in missing)
if before == after:
    print('Local host mappings already correct')
    raise SystemExit(0)
print(''.join(difflib.unified_diff(before.splitlines(True), after.splitlines(True), fromfile='/etc/hosts (current)', tofile='/etc/hosts (proposed)')))
if not args.apply:
    print('Preview only. Apply with sudo and --apply; no network security settings change.')
    raise SystemExit(0)
if os.geteuid() != 0:
    raise SystemExit('Administrator rights required: run this script with sudo --apply')
backup = Path('/var/root/homelab-dns-backups')
backup.mkdir(mode=0o700, exist_ok=True)
saved = backup / ('hosts.' + str(int(time.time())))
shutil.copy2(p, saved)
p.write_text(after)
subprocess.run(['/usr/bin/dscacheutil', '-flushcache'], check=True)
subprocess.run(['/usr/bin/killall', '-HUP', 'mDNSResponder'], check=False)
print('Applied local mappings. Original saved at ' + str(saved))
