import sys
import json
import time
from microdotphat import clear, show, write_string

while True:
    line = sys.stdin.readline()
    if line:
        print('line', line)
        cmd = json.loads(line)
        if cmd['cmd'] == 'clear':
            clear()
        if cmd['cmd'] == 'write_string':
            write_string(cmd['arg'], kerning=False)
            show()

    time.sleep(0.1)
