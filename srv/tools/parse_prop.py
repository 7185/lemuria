#!/usr/bin/env python
import pprint

output = {"objects": []}

f = open('prop.dmp', 'r', encoding='ISO-8859-1')
for l in f:
    s = l.split(' ')
    if s[0] == 'propdump':
        continue
    output["objects"].append([s[11][:int(s[8])], int(s[2]), int(s[3]), int(s[4]), int(s[6]), int(s[5]), int(s[7])])

s = pprint.pformat(output).replace("'", '"')
print(s)
