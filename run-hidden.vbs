' تشغيل ملف البتات بدون نافذة سوداء
Set sh = CreateObject("WScript.Shell")
Set args = WScript.Arguments
If args.Count > 0 Then
    sh.Run """" & args(0) & """", 0, False
End If
