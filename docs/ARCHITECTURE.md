/awaaz
  /client                 React frontend
    /src
      /components         Reusable UI pieces
      /pages              Route-level views
      /context            Auth context, global state
      api.js              ALL fetch calls live here only
      firebase.js         Firebase init
  /server                 Node.js backend
    /routes               One file per route group
    /agents               ingestionAgent.js, communityAgent.js, truthEngine.js
    /middleware            verifyToken.js
    /utils                haversine.js, priorityScore.js
    index.js              Server entry point
    firebase-admin.js     Admin SDK init
  /docs                   Your anchor files
  /scripts                seed.js for demo data
  .env                    Never committed
  .env.example            Committed with placeholder values
