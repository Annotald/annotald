import unittest
import time

import logs

class LogsTest(unittest.TestCase):
    maxDiff = None
    def test_normalizeIntervals(self):
        t = time.mktime(time.strptime("2012-08-19 00:00:00",
                                      "%Y-%m-%d %H:%M:%S"))
        intervals = [(t, 60*60*24.0 + 1, "working")]
        self.assertEqual(logs.normalizeIntervals(intervals),
                         [(t, 60*60*24.0 - 1, "working"),
                          (t + 60*60*24, 1, "working")])

    def test_breakIntervals(self):
        intervals = []
        brokenIntervals = []
        for i in ["19","20","21"]:
            x = []
            t = time.mktime(time.strptime("2012-08-" + i + " 00:00:00",
                                          "%Y-%m-%d %H:%M:%S"))
            intervals.append((t, 60*60, "working", "2012-08-" + i))
            x.append((0.0, 60*60, "working", "2012-08-" + i))

            t = time.mktime(time.strptime("2012-08-" + i + " 00:03:00",
                                          "%Y-%m-%d %H:%M:%S"))
            intervals.append((t, 60*60, "working", "2012-08-" + i))
            x.append((180.0, 60*60, "working", "2012-08-" + i))

            brokenIntervals.append(x)

        self.assertEqual(logs.breakIntervals(intervals), brokenIntervals)
