import sys
import json
import time
from microdotphat import clear, show, scroll, write_string, set_pixel

while True:
    line = sys.stdin.readline()
    if line:
        #print('line', line)
        cmd = json.loads(line)
        if cmd['cmd'] == 'clear':
            clear()
        if cmd['cmd'] == 'write_string':
            write_string(cmd['arg1'], kerning=False)
            show()
        if cmd['cmd'] == 'write_string_scroll': # breaks everything
            write_string(cmd['arg1'])
            scroll()
            show()
        if cmd['cmd'] == 'set_pixel':
            set_pixel(cmd['arg1'], cmd['arg2'], cmd['arg3'])
            show()

    time.sleep(0.1)
