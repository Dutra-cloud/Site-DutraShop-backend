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
        await seedDatabaseIfNeeded(); // Adicionado para popular o DB
    } catch (err) {
        console.error("Erro ao criar tabelas", err);
    }
};

// --- FUNÇÃO PARA POPULAR O BANCO DE DADOS (SEED) ---
const seedDatabaseIfNeeded = async () => {
    try {
        const productCountResult = await pool.query('SELECT COUNT(*) FROM products');
        if (parseInt(productCountResult.rows[0].count) > 0) {
            console.log("Banco de dados já populado.");
            return;
        }
        console.log("Banco de dados vazio. Populando com produtos iniciais...");
        const productsToInsert = [
            { id: 1, name: 'Notebook Pro Gamer', price: 7499.90, image: 'imagens/notebook.jpg', rating: 4.8, reviewCount: 128, category: 'notebooks', stock: 10 },
            { id: 3, name: 'Headset Imersivo 7.1', price: 899.50, image: 'imagens/headset.jpg', rating: 4.9, reviewCount: 215, category: 'perifericos', stock: 25 },
            { id: 4, name: 'Teclado Mecânico RGB', price: 650.00, image: 'imagens/teclado.jpg', rating: 4.7, reviewCount: 173, category: 'perifericos', stock: 15 },
            { id: 5, name: 'Mouse Gamer 16k DPI', price: 450.00, image: 'imagens/mouse.jpg', rating: 4.8, reviewCount: 155, category: 'perifericos', stock: 30 },
            { id: 6, name: 'Monitor Curvo 144Hz', price: 2800.00, image: 'imagens/monitor.jpg', rating: 4.9, reviewCount: 102, category: 'monitores', stock: 3 },
            { id: 8, name: 'Placa de Vídeo RTX 4070', price: 4599.00, image: 'imagens/gpu.jpg', rating: 5.0, reviewCount: 76, category: 'componentes', stock: 8 },
            { id: 9, name: 'Gabinete Gamer com RGB', price: 799.00, image: 'imagens/gabinete.jpg', rating: 4.7, reviewCount: 54, category: 'componentes', stock: 0 },
        ];
        for (const p of productsToInsert) {
            await pool.query("INSERT INTO products (id, name, price, image, rating, reviewCount, category, stock) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [p.id, p.name, p.price, p.image, p.rating, p.reviewCount, p.category, p.stock]);
        }
        console.log("Produtos iniciais inseridos com sucesso.");
    } catch (err) {
        console.error("Erro ao popular o banco de dados:", err);
    }
};

// --- ROTAS DA API ---
app.get('/api/products', async (req, res) => { try { const result = await pool.query('SELECT * FROM products'); res.json(result.rows); } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno do servidor' }); } });
app.get('/api/products/:id', async (req, res) => { try { const { id } = req.params; const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]); if (result.rows.length === 0) { return res.status(404).json({ error: 'Produto não encontrado' }); } res.json(result.rows[0]); } catch (err) { console.error(err); res.status(500).json({ error: 'Erro interno do servidor' }); } });
app.post('/api/register', async (req, res) => {
    try {
        console.log("1. Rota de CADASTRO iniciada.");
        const { name, email, password } = req.body;
        console.log("2. Criptografando senha...");
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log("3. Senha criptografada. Inserindo no banco de dados...");
        const newUser = await pool.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email', [name, email, hashedPassword]);
        console.log("4. Usuário inserido com sucesso.");
        res.status(201).json(newUser.rows[0]);
    } catch (err) {
        console.log("X. ERRO no bloco catch do cadastro.");
        if (err.code === '23505') { return res.status(409).json({ error: 'Este e-mail já está cadastrado.' }); }
        console.error("Erro detalhado no cadastro:", err);
        res.status(500).json({ error: 'Ocorreu um erro inesperado.' });
    }
});
app.post('/api/login', async (req, res) => {
    try {
        console.log("1. Rota de LOGIN iniciada.");
        const { email, password } = req.body;
        console.log("2. Buscando usuário com email:", email);
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        console.log("3. Busca no banco de dados concluída.");
        const user = result.rows[0];
        if (!user) { console.log("4. Usuário não encontrado."); return res.status(404).json({ error: 'Usuário não encontrado.' }); }
        console.log("5. Usuário encontrado. Comparando senhas...");
        const isMatch = await bcrypt.compare(password, user.password);
        console.log("6. Comparação de senhas concluída.");
        if (!isMatch) { console.log("7. Senha incorreta."); return res.status(401).json({ error: 'Senha incorreta.' }); }
        console.log("8. Login bem-sucedido. Enviando resposta.");
        res.json({ success: 'Login bem-sucedido!', user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        console.log("X. ERRO no bloco catch do login.");
        console.error("Erro detalhado no login:", err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
app.post('/api/orders', async (req, res) => { console.log("DADOS RECEBIDOS NA ROTA /api/orders:", req.body); const { userId, items } = req.body; if (!userId || !items || !Array.isArray(items) || items.length === 0) { console.error("Validação falhou: dados do pedido inválidos.", req.body); return res.status(400).json({ error: 'Dados do pedido inválidos.' }); } const client = await pool.connect(); try { await client.query('BEGIN'); let totalPrice = 0; for (const item of items) { const productResult = await client.query('SELECT price, stock FROM products WHERE id = $1', [item.id]); const product = productResult.rows[0]; if (!product || item.quantity > product.stock) { throw new Error(`Produto ${item.id} indisponível.`); } totalPrice += product.price * item.quantity; } const orderResult = await client.query('INSERT INTO orders (user_id, total_price) VALUES ($1, $2) RETURNING id', [userId, totalPrice]); const orderId = orderResult.rows[0].id; for (const item of items) { await client.query('INSERT INTO order_items (order_id, product_id, quantity, price_per_unit) VALUES ($1, $2, $3, $4)', [orderId, item.id, item.quantity, item.price]); await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.id]); } await client.query('COMMIT'); res.status(201).json({ success: true, orderId: orderId }); } catch (err) { await client.query('ROLLBACK'); console.error('Erro ao criar o pedido:', err); res.status(500).json({ error: 'Erro ao processar o pedido.' }); } finally { client.release(); } });
app.get('/api/orders', async (req, res) => { const userId = req.query.userId; if (!userId) { return res.status(400).json({ error: 'ID do usuário é obrigatório.' }); } try { const sql = `SELECT id, order_date, total_price FROM orders WHERE user_id = $1 ORDER BY order_date DESC`; const result = await pool.query(sql, [userId]); res.json(result.rows); } catch (err) { console.error("Erro ao buscar pedidos:", err); res.status(500).json({ error: 'Erro interno do servidor' }); } });

// --- INICIAR O SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor da API rodando na porta ${PORT}`);
    createTables();
});