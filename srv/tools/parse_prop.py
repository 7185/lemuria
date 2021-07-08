#!/usr/bin/env python
import json

output = {"objects": []}

f = open('prop.dmp', 'r', encoding='ISO-8859-1')
for l in f:
    s = l.split(' ')
    if s[0] == 'propdump':
        continue
    desc = None
    act = None
    data = ' '.join(s[11:])
    obj_len = int(s[8])
    desc_len = int(s[9])
    act_len = int(s[10])
    output["objects"].append([int(s[1]), data[:obj_len], int(s[2]), int(s[3]), int(s[4]), int(s[6]), int(s[5]), int(s[7]),
                              data[obj_len:obj_len + desc_len] or None, data[obj_len + desc_len:obj_len + desc_len + act_len] or None])

s = json.dumps(output)
print(s)
