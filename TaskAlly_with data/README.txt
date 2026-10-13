TaskAlly - Office Server Edition
================================
Shared task tracker for your team. One PC (the "host") runs TaskAlly;
everyone else opens it in their browser. No internet or sign-in needed.

QUICK START (needs Node.js, free from https://nodejs.org - choose LTS)
1. Unzip this folder on the host PC.
2. Double-click START-TaskAlly.bat. A window opens and shows two addresses.
3. On the host PC use http://localhost:3000
   Team members (same office Wi-Fi/LAN) open the "Team" address shown,
   e.g. http://192.168.1.20:3000
4. Keep that window open while the team works.

If Windows Firewall asks, click "Allow access" (Private networks).

MAKE A TaskAlly.exe (optional, so Node.js is not needed on the host)
1. On a Windows PC with Node.js, double-click BUILD-EXE.bat (needs internet once).
2. It creates TaskAlly.exe. Double-click it to start the server.
   Keep the "data" folder beside the exe - that is where tasks are saved.

SAMPLE DATA
- The first time it runs, TaskAlly loads draft sample data (4 members, 14 tasks, 3 comments)
  so a reviewer sees a populated app. To start with an EMPTY app instead, run
  START-EMPTY.bat the first time (or delete the "data" folder, then use START-EMPTY.bat).

YOUR DATA
- Saved in data\taskally.json. A daily backup is kept in data\backups.
- To move to another PC, copy the "data" folder.
- Back up this folder regularly (e.g. copy it to a pen drive).

DIFFERENT PORT:  server.js 8080   (or set PORT=8080)

NOTES
- No login: anyone on your network who opens the address can see all data.
- Comment emails open the admin's mail app with the message ready to send.
