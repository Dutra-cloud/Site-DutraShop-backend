const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./loja.db', (err) => {
    if (err) {
        return console.error("Erro ao abrir o banco de dados", err.message);
    }
    
    console.log("Conectado ao banco de dados 'loja.db'.");
    
    db.serialize(() => {
        // 1. Tabela de produtos (sem alterações)
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL, image TEXT,
            rating REAL, reviewCount INTEGER, category TEXT, stock INTEGER
        )`, (err) => {
            if (err) { return console.error("Erro ao criar a tabela 'products'", err.message); }
            console.log("Tabela 'products' verificada/criada com sucesso.");
        });

        // ======================================================
        // 2. NOVA TABELA DE USUÁRIOS
        // ======================================================
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )`, (err) => {
            if (err) { return console.error("Erro ao criar a tabela 'users'", err.message); }
            console.log("Tabela 'users' verificada/criada com sucesso.");
        });

    }, () => {
        // Fecha a conexão após garantir que tudo foi executado.
        db.close((err) => {
            if (err) { return console.error(err.message); }
            console.log('Setup do banco de dados concluído. Conexão fechada.');
        });
    });
});