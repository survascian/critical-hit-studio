'use strict';
const { classify, classifyScript, classifyFolder } = require('../launcher.js');
let bad = 0;
const want = (input, kind) => { const c = classify(input); if (c.kind !== kind) { bad++; console.log('FAIL classify', JSON.stringify(input), '->', c.kind, 'expected', kind); } };
const wantScript = (input, kind) => { const c = classifyScript(input); if (c.kind !== kind) { bad++; console.log('FAIL classifyScript', JSON.stringify(input), '->', c.kind, 'expected', kind); } };
const wantFolder = (input, kind) => { const c = classifyFolder(input); if (c.kind !== kind) { bad++; console.log('FAIL classifyFolder', JSON.stringify(input), '->', c.kind, 'expected', kind); } };
['steam://rungameid/1245620', 'com.epicgames.launcher://apps/Fortnite?action=launch', 'goggalaxy://openGameView/1207658924', 'battlenet://Pro', 'xbox://', 'STEAM://rungameid/1'].forEach((x) => want(x, 'url'));
['C:\\Users\\Alan\\Desktop\\Elden Ring.lnk', 'D:/Games/Game/game.exe', 'C:\\Games\\x.url', '\\\\nas\\games\\a.lnk', '/home/a/game.exe'].forEach((x) => want(x, 'file'));
['', '   ', null, undefined, 'javascript:alert(1)', 'file:///C:/Windows/System32/cmd.exe', 'http://evil.com', 'https://evil.com/a.exe', 'cmd.exe', 'game.lnk', 'C:\\x\\a.bat', 'C:\\x\\a.ps1', 'C:\\x\\a.msi', 'C:\\x\\a.vbs', 'C:\\x\\..\\y\\a.exe', 'C:\\x\\a.exe\u0000.txt', 'C:\\x\\a.exe\nnet user', 'calc://', 'ms-msdt://id', 'vscode://x', 'x'.repeat(1200)].forEach((x) => want(x, 'bad'));

['C:\\Users\\Alan\\Scripts\\elden.docx', 'D:/Scripts/notes.md', 'C:\\Docs\\review.txt', 'C:\\Docs\\draft.pdf', 'C:\\Docs\\script.fountain', '\\\\nas\\scripts\\a.rtf', '/home/alan/script.odt'].forEach((x) => wantScript(x, 'file'));
['', '   ', null, undefined, 'https://docs.google.com/document/d/123', 'relative.docx', 'C:\\x\\a.exe', 'C:\\x\\a.bat', 'C:\\x\\a.ps1', 'C:\\x\\..\\y\\a.md', 'C:\\x\\a.txt\u0000.exe', 'x'.repeat(1200)].forEach((x) => wantScript(x, 'bad'));

['D:\\Videos\\Elden Ring', 'C:/Projects/Supercut', '\\\\nas\\footage\\re4', '/mnt/videos/hades'].forEach((x) => wantFolder(x, 'dir'));
['', '   ', null, undefined, 'Videos\\Elden Ring', 'https://drive.google.com/drive', 'D:\\Videos\\..\\Secret', 'D:\\Videos\\a\nwhoami', 'x'.repeat(1200)].forEach((x) => wantFolder(x, 'bad'));

console.log(bad ? bad + ' FAILED' : 'ALL PASSED (launch, script, and folder target safety)');
process.exit(bad ? 1 : 0);
