// ARQUIVO server.js (VERSÃO FINAL PARA DEPLOY)

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// --- CONEXÃO COM O BANCO DE DADOS POSTGRESQL ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- FUNÇÃO PARA CRIAR AS TABELAS SE NÃO EXISTIREM ---
const createTables = async () => {
    const createProductsTable = `
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL, image TEXT,
        rating REAL, reviewCount INTEGER, category TEXT, stock INTEGER
    )`;
    
    const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL
    )`;

    try {
        await pool.query(createProductsTable);
        console.log("Tabela 'products' verificada/criada com sucesso.");
        await pool.query(createUsersTable);
        console.log("Tabela 'users' verificada/criada com sucesso.");
    } catch (err) {
        console.error("Erro ao criar tabelas", err);
    }
};

// --- ROTAS DA API ---

// Rotas de produtos (sem alterações)
app.get('/api/products', async (req, res) => { try { const result = await pool.query('SELECT * FROM products'); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno do servidor' }); } });
app.get('/api/products/:id', async (req, res) => { try { const { id } = req.params; const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]); if (result.rows.length === 0) { return res.status(404).json({ error: 'Produto não encontrado' }); } res.json(result.rows[0]); } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno do servidor' }); } });
app.patch('/api/products/update-stock', async (req, res) => { const client = await pool.connect(); try { const { items } = req.body; await client.query('BEGIN'); for (const item of items) { await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1', [item.quantity, item.id]); } await client.query('COMMIT'); res.status(200).json({ success: 'Estoque atualizado com sucesso!' }); } catch (err) { await client.query('ROLLBACK'); console.error(err); res.status(500).json({ error: 'Erro ao atualizar o estoque' }); } finally { client.release(); } });

// Rota de registrar (sem alterações)
app.post('/api/register', async (req, res) => { try { const { name, email, password } = req.body; const hashedPassword = await bcrypt.hash(password, 10); const newUser = await pool.query( 'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email', [name, email, hashedPassword] ); res.status(201).json(newUser.rows[0]); } catch (err) { console.error(err); res.status(500).json({ error: 'Email já pode estar em uso ou erro no servidor' }); } });

// ROTA DE LOGIN (COM A CORREÇÃO)
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        
        if (!user) {
            // AQUI ESTAVA O ERRO DE DIGITAÇÃO
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Senha incorreta.' });
        }
        res.json({ success: 'Login bem-sucedido!', user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});


// --- INICIAR O SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor da API rodando na porta ${PORT}`);
    createTables();
});