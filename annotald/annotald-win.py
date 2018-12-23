import os
import sys
import time
import traceback
import webbrowser
import _thread

import wx
from wxPython.wx import *

from annotald import treedrawing, util

ID_LAUNCH_SERVER = wx.NewId()
ID_CHROME = wx.NewId()

# needed for py2exe to work properly
#sys.stdout = open( os.path.expanduser("~/annotald.out.log.txt"), "w" )
sys.stderr = util.Blackhole() # open( os.path.expanduser("~/annotald.err.log.txt"), "w" )
sys.stdout = util.Blackhole()
#sys.stderr = None

class TaskBarApp(wx.Frame):
    def __init__(self, parent, id, title):
        wx.Frame.__init__(self, parent, -1, title, size = (1, 1),
            style=wx.FRAME_NO_TASKBAR|wx.NO_FULL_REPAINT_ON_RESIZE)

        self.tbicon = wx.TaskBarIcon()
        self.tbicon.SetIcon(wx.Icon('user-plain-red.png', wx.BITMAP_TYPE_PNG), "Annotald")

        self.tbicon.Bind(wx.EVT_TASKBAR_RIGHT_UP,self.ShowMenu)    
        self.tbicon.Bind(wx.EVT_MENU, self.startServer, id=ID_LAUNCH_SERVER)      
        self.tbicon.Bind(wx.EVT_MENU, self.startChrome, id=ID_CHROME)
         
        self.tbmenu = wx.Menu()    
        self.tbopen = self.tbmenu.Append(ID_LAUNCH_SERVER, 'Open File')
        self.tbchrome = self.tbmenu.Append(ID_CHROME, 'Chrome to: localhost:8080')
#        self.tbmenu.Append(ID_START_CHROME, '')

        self.Show(True)

    def ShowMenu(self, event):
        self.tbicon.PopupMenu(self.tbmenu)
        #self.startChrome()
        #raise SystemExit(0)        
    
    def getPsdPath(self):
        # Create an open file dialog    
        try:
            dialog = wxFileDialog ( None, style = wxOPEN, message = 'Hey what\'s up, please pick a psd file for Annotald' )         
            # Show the dialog and get user input
            if dialog.ShowModal() == wxID_OK:
                print(('Selected:', dialog.GetPath()))
                path = dialog.GetPath()
                dialog.Destroy()
                return path
            # The user did not select anything    
            else:
                dialog.Destroy()
                return None
        except:
            print('>>> traceback <<<')
            traceback.print_exc()
            print('>>> end of traceback <<<')           

    def startServer(self,event):
        _thread.start_new_thread(self.serverThread, ())
    
    def serverThread(self):
        #print('stuff')
        filename = self.getPsdPath()

        if filename is None:
            pass
        else:
            args = [filename]
            try:
                # wait for cherrypy, TODO: check when server is running
                time.sleep(4)
                self.startChrome()
                self.tbopen.Enable(False)
                self.tbicon.SetIcon(wx.Icon('user-plain-blue.png', wx.BITMAP_TYPE_PNG), "Annotald")
                treedrawing._main(args)
                self.tbicon.SetIcon(wx.Icon('user-plain-red.png', wx.BITMAP_TYPE_PNG), "Annotald")
                self.tbopen.Enable(True)
            except:
                print('>>> traceback <<<')
                traceback.print_exc()
                print('>>> end of traceback <<<')
                  
    def startChrome(self,event=None):
        _thread.start_new_thread(self.chromeThread, ())
                        
    def chromeThread(self):
        os.system("start chrome localhost:8080")

class AnnotaldRunner(wx.App):
    def OnInit(self):
        frame = TaskBarApp(None, -1, ' ')
        frame.Center(wx.BOTH)
        frame.Show(False)        
        #args = ['../test.psd']
        #treedrawing._main(args)
        return True
 
def _main(argv=None):
    if argv is None:
        argv = sys.argv
    app = AnnotaldRunner(0)
    app.MainLoop()
 
if __name__ == '__main__':
    _main()
