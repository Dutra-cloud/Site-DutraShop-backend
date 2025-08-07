// ARQUIVO server.js (VERSÃO FINAL E COMPLETA)

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// Logger para cada requisição que chega na API
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] Recebida requisição: ${req.method} ${req.url}`);
    next();
});

// --- CONEXÃO COM O BANCO DE DADOS POSTGRESQL ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- FUNÇÃO PARA CRIAR AS TABELAS ---
const createTables = async () => {
    const createProductsTable = `CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL, image TEXT, rating REAL, reviewCount INTEGER, category TEXT, stock INTEGER)`;
    const createUsersTable = `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL)`;
    const createOrdersTable = `CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, total_price REAL NOT NULL, FOREIGN KEY (user_id) REFERENCES users (id))`;
    const createOrderItemsTable = `CREATE TABLE IF NOT EXISTS order_items (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL, price_per_unit REAL NOT NULL, FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE, FOREIGN KEY (product_id) REFERENCES products (id))`;
    try {
        await pool.query(createProductsTable); console.log("Tabela 'products' verificada/criada.");
        await pool.query(createUsersTable); console.log("Tabela 'users' verificada/criada.");
        await pool.query(createOrdersTable); console.log("Tabela 'orders' verificada/criada.");
        await pool.query(createOrderItemsTable); console.log("Tabela 'order_items' verificada/criada.");
    } catch (err) {
        console.error("Erro ao criar tabelas", err);
    }
};

// --- ROTAS DA API ---
app.get('/api/products', async (req, res) => { try { const result = await pool.query('SELECT * FROM products'); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno do servidor' }); } });
app.get('/api/products/:id', async (req, res) => { try { const { id } = req.params; const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]); if (result.rows.length === 0) { return res.status(404).json({ error: 'Produto não encontrado' }); } res.json(result.rows[0]); } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno do servidor' }); } });
app.post('/api/register', async (req, res) => { try { const { name, email, password } = req.body; const hashedPassword = await bcrypt.hash(password, 10); const newUser = await pool.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email', [name, email, hashedPassword]); res.status(201).json(newUser.rows[0]); } catch (err) { if (err.code === '23505') { return res.status(409).json({ error: 'Este e-mail já está cadastrado.' }); } console.error("Erro detalhado no cadastro:", err); res.status(500).json({ error: 'Ocorreu um erro inesperado.' }); } });
app.post('/api/login', async (req, res) => { try { const { email, password } = req.body; const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]); const user = result.rows[0]; if (!user) { return res.status(404).json({ error: 'Usuário não encontrado.' }); } const isMatch = await bcrypt.compare(password, user.password); if (!isMatch) { return res.status(401).json({ error: 'Senha incorreta.' }); } res.json({ success: 'Login bem-sucedido!', user: { id: user.id, name: user.name, email: user.email } }); } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno do servidor' }); } });

app.post('/api/orders', async (req, res) => {
    console.log("DADOS RECEBIDOS NA ROTA /api/orders:", req.body);
    const { userId, items } = req.body;
    if (!userId || !items || !Array.isArray(items) || items.length === 0) {
        console.error("Validação falhou: dados do pedido inválidos.", req.body);
        return res.status(400).json({ error: 'Dados do pedido inválidos.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let totalPrice = 0;
        for (const item of items) {
            const productResult = await client.query('SELECT price, stock FROM products WHERE id = $1', [item.id]);
            const product = productResult.rows[0];
            if (!product || item.quantity > product.stock) { throw new Error(`Produto ${item.id} indisponível ou com estoque insuficiente.`); }
            totalPrice += product.price * item.quantity;
        }
        const orderResult = await client.query('INSERT INTO orders (user_id, total_price) VALUES ($1, $2) RETURNING id', [userId, totalPrice]);
        const orderId = orderResult.rows[0].id;
        for (const item of items) {
            await client.query('INSERT INTO order_items (order_id, product_id, quantity, price_per_unit) VALUES ($1, $2, $3, $4)', [orderId, item.id, item.quantity, item.price]);
            await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.id]);
        }
        await client.query('COMMIT');
        res.status(201).json({ success: true, orderId: orderId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro detalhado ao criar o pedido:', err);
        res.status(500).json({ error: 'Erro ao processar o pedido.' });
    } finally {
        client.release();
    }
});
// COLE ESTE BLOCO NO FINAL DAS SUAS ROTAS, ANTES DE INICIAR O SERVIDOR

// ======================================================
// --- ROTA NOVA: Buscar o Histórico de Pedidos de um Usuário ---
// ======================================================
app.get('/api/orders', async (req, res) => {
    // Pegamos o ID do usuário que vem na URL (ex: /api/orders?userId=1)
    const userId = req.query.userId;

    if (!userId) {
        return res.status(400).json({ error: 'ID do usuário é obrigatório.' });
    }

    try {
        // Comando SQL para buscar os dados principais dos pedidos de um usuário específico, ordenados do mais recente para o mais antigo
        const sql = `
            SELECT id, order_date, total_price 
            FROM orders 
            WHERE user_id = $1 
            ORDER BY order_date DESC
        `;
        const result = await pool.query(sql, [userId]);
        // Retorna as linhas encontradas como JSON
        res.json(result.rows);
    } catch (err) {
        console.error("Erro ao buscar pedidos:", err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
// --- INICIAR O SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor da API rodando na porta ${PORT}`);
    createTables();
});