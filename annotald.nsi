; annotald.nsi
!define VERSION "12.3"

			;--------------------------------

			; The name of the installer
			name "Annotald ${VERSION}"

			; The file to write
			outFile "release/annotald-${VERSION}-windows-setup.exe"

			;Require admin rights on NT6+ (When UAC is turned on)
			RequestExecutionLevel user 

			; The default installation directory
			installDir $LOCALAPPDATA\annotald

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
			createShortCut "$SMPROGRAMS\Annotald ${VERSION}\Annotald.lnk" "$INSTDIR\annotald-win.exe"
			createShortCut "$SMPROGRAMS\Annotald\Uninstall Annotald.lnk" "$INSTDIR\uninstall.exe"


			!define START_LINK_DIR "$STARTMENU\Programs\Annotald"
			!define START_LINK_RUN "$STARTMENU\Programs\Annotald\Annotald.lnk"
			!define START_LINK_UNINSTALLER "$STARTMENU\Programs\Annotald\Uninstall Annotald.lnk"

			;# In your main installer section...
			SetShellVarContext current
			CreateDirectory "${START_LINK_DIR}"
			CreateShortCut "${START_LINK_RUN}" "$INSTDIR\annotald-win.exe"
			CreateShortCut "${START_LINK_UNINSTALLER}" "$INSTDIR\Annotald-Uninstall.exe"
	

			;WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\annotald-${VERSION}" "DisplayName"\
			;"Annotald (remove only)"

			;WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\annotald-${VERSION}" "UninstallString" \
			;"$INSTDIR\uninstall.exe"
			
			!define REG_UNINSTALL "Software\Microsoft\Windows\CurrentVersion\Uninstall\annotald-${VERSION}"
			
			WriteRegStr HKCU "${REG_UNINSTALL}" "DisplayName" "Annotald (remove only)"
			WriteRegStr HKCU "${REG_UNINSTALL}" "UninstallString" "$INSTDIR\uninstall.exe"
			
			;WriteRegStr HKCU "${REG_UNINSTALL}" "DisplayIcon" "$\"$INSTDIR\OnTopReplica.exe$\""
			;WriteRegStr HKCU "${REG_UNINSTALL}" "Publisher" "Lorenz Cuno Klopfenstein"
			;WriteRegStr HKCU "${REG_UNINSTALL}" "DisplayVersion" "3.1.0.0"
			;WriteRegDWord HKCU "${REG_UNINSTALL}" "EstimatedSize" 800 ;KB
			;WriteRegStr HKCU "${REG_UNINSTALL}" "HelpLink" "${WEBSITE_LINK}"
			;WriteRegStr HKCU "${REG_UNINSTALL}" "URLInfoAbout" "${WEBSITE_LINK}"
			;WriteRegStr HKCU "${REG_UNINSTALL}" "InstallLocation" "$\"$INSTDIR$\""
			;WriteRegStr HKCU "${REG_UNINSTALL}" "InstallSource" "$\"$EXEDIR$\""
			;WriteRegDWord HKCU "${REG_UNINSTALL}" "NoModify" 1
			;WriteRegDWord HKCU "${REG_UNINSTALL}" "NoRepair" 1
			;WriteRegStr HKCU "${REG_UNINSTALL}" "Comments" "Uninstalls OnTopReplica."




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
			    ;DeleteRegKey HKEY_LOCAL_MACHINE "Software\annotald-${VERSION}"
			    ;DeleteRegKey HKEY_LOCAL_MACHINE "Software\Microsoft\Windows\CurrentVersion\Uninstall\annotald-${VERSION}"
			    DeleteRegKey HKLM "Software\annotald-${VERSION}"
			    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\annotald-${VERSION}"
			sectionEnd			
		
