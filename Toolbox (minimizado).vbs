' Abre a Toolbox com a janela do servidor minimizada.
' Dica: coloque um atalho deste arquivo em shell:startup para iniciar com o Windows.
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "Toolbox.bat", 7, False
