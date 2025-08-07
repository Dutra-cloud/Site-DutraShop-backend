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

// --- FUNÇÃO PARA CRIAR AS TABELAS (ATUALIZADA) ---
const createTables = async () => {
    // Tabela de produtos (sem alterações)
    const createProductsTable = `CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL, image TEXT, rating REAL, reviewCount INTEGER, category TEXT, stock INTEGER)`;
    
    // Tabela de usuários (sem alterações)
    const createUsersTable = `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL)`;

    // ======================================================
    // NOVA TABELA: orders (a "capa" do pedido)
    // ======================================================
    const createOrdersTable = `
    CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_price REAL NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`;

    // ======================================================
    // NOVA TABELA: order_items (os produtos de cada pedido)
    // ======================================================
    const createOrderItemsTable = `
    CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price_per_unit REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
    )`;

    try {
        await pool.query(createProductsTable);
        console.log("Tabela 'products' verificada/criada com sucesso.");
        await pool.query(createUsersTable);
        console.log("Tabela 'users' verificada/criada com sucesso.");
        await pool.query(createOrdersTable);
        console.log("Tabela 'orders' verificada/criada com sucesso.");
        await pool.query(createOrderItemsTable);
        console.log("Tabela 'order_items' verificada/criada com sucesso.");
    } catch (err) {
        console.error("Erro ao criar tabelas", err);
    }
};

// --- ROTAS DA API (sem alterações por enquanto) ---
// ... (todo o resto do seu server.js continua aqui)
// ...

// --- INICIAR O SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor da API rodando na porta ${PORT}`);
    createTables(); // Garante que as tabelas sejam criadas ao iniciar
});