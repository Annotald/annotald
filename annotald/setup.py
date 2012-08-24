from distutils.core import setup
import py2exe
import shutil
import os
import glob



annotald_data_files = []

annotald_data_files.append( ('', ['settings.js','CS_Tony_oct19.jar','nothing.q','user-plain-red.png','user-plain-blue.png']) )

html_files =  glob.glob('data/html/*.mako')
annotald_data_files.append( ('data/html', html_files) )

image_files =  glob.glob('data/images/*.png')
annotald_data_files.append( ('data/images', image_files) )

script_files =  glob.glob('data/scripts/*.js')
annotald_data_files.append( ('data/scripts', script_files) )

css_files =  glob.glob('data/css/*.css')
annotald_data_files.append( ('data/css', css_files) )


#css_files = find_data_files('data/css','',['data/css/*'])
#script_files = find_data_files('data/scripts','',['data/*.css'])
#image_files = find_data_files('data/images','',['data/*.png'])

setup(windows=['annotald-win.py'],
      data_files = annotald_data_files,
      options={ "py2exe":{ "skip_archive": True } })  
#shutil.copy('settings.py','dist')


 