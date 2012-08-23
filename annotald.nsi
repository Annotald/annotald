; annotald.nsi
!define VERSION "12.3"

			;--------------------------------

			; The name of the installer
			name "Annotald ${VERSION}"

			; The file to write
			outFile "release/annotald-${VERSION}-windows-setup.exe"

			; The default installation directory
			installDir $PROGRAMFILES\annotald

			; The text to prompt the user to enter a directory
			dirText "This will install Annotald on your computer. Choose a directory"

			;--------------------------------

			; The stuff to install
			Section "" ;No components page, name is not important

			; Set output path to the installation directory.
			setOutPath $INSTDIR

			; Put files there
			File /r treedrawing/dist/*
			;# create the uninstaller
			writeUninstaller "$INSTDIR\uninstall.exe"

			createDirectory "$SMPROGRAMS\Annotald"
			createShortCut "$SMPROGRAMS\Annotald ${VERSION}\Annotald.lnk" "$INSTDIR\treedrawing.exe"
			createShortCut "$SMPROGRAMS\Annotald\Uninstall Annotald.lnk" "$INSTDIR\uninstall.exe"


			WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\annotald-${VERSION}" "DisplayName"\
			"Annotald (remove only)"

			WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\annotald-${VERSION}" "UninstallString" \
			"$INSTDIR\uninstall.exe"

			sectionEnd ; end the section

			# uninstaller section start
			section "uninstall"
			 
			    # first, delete the uninstaller
			    delete "$INSTDIR\uninstall.exe"
			    RMDIR /r "$INSTDIR"
			
			    # second, remove the link from the start menu
			    
			    delete "$SMPROGRAMS\Annotald\Annotald.lnk"
                delete "$SMPROGRAMS\Annotald\Uninstall Annotald.lnk"
			
			    RMDIR /r "$SMPROGRAMS\Annotald"

			    # delete registry keys
			    DeleteRegKey HKEY_LOCAL_MACHINE "Software\annotald-${VERSION}"
			    DeleteRegKey HKEY_LOCAL_MACHINE "Software\Microsoft\Windows\CurrentVersion\Uninstall\annotald-${VERSION}"
			sectionEnd			
		
