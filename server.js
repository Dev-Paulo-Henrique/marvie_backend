const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();
const PORT = 3000;
const bcrypt = require('bcrypt');
const saltRounds = 10;

// docker run --name mysql -e MYSQL_ROOT_PASSWORD=ifpecjbg -e MYSQL_DATABASE=marvie -p 3307:3306 -d mysql:latest  

app.use(bodyParser.json());

app.use(cors());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'ifpecjbg',
  database: 'marvie',
  port: 3307
});

db.connect(err => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
    return;
  }
  console.log('Conectado ao banco de dados MySQL');
}); 
 
// Criar tabela Users
db.query(
  `CREATE TABLE IF NOT EXISTS users (
id INT AUTO_INCREMENT PRIMARY KEY, 
nome VARCHAR(255) NOT NULL, 
data_nascimento DATE NOT NULL, 
email VARCHAR(255) NOT NULL, 
telefone VARCHAR(20) NOT NULL,
cep VARCHAR(10) NOT NULL,
senha VARCHAR(255) NOT NULL,
papel ENUM('Administrador', 'Cliente', 'Funcionário') NOT NULL,
numero varchar(10) NOT NULL,
createdAt DATETIME NOT NULL)`,
  err => {
    if (err) {
      console.error('Erro ao criar tabela:', err.message); 
      return;
    }
    console.log('Tabela "users" criada ou já existente');
  }
);  

// Criar tabela Products
db.query(
  `CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(45) NULL,
    descricao VARCHAR(45) NOT NULL,
    estoque INT NOT NULL,
    data_fabricacao DATE NOT NULL,
    valor FLOAT NOT NULL,
    categoria INT NOT NULL)`,
  err => {
    if (err) {
      console.error('Erro ao criar tabela:', err.message); 
      return;
    }
    console.log('Tabela "products" criada ou já existente');
  }
);  

const createAdminIfTableEmpty = () => {
  db.query('SELECT COUNT(*) AS count FROM users', (err, results) => {
    if (err) {
      console.error('Erro ao verificar a tabela:', err.message);
      return;
    }

    const formatDateForMySQL = (date) => {
      const padTo2Digits = (num) => {
        return num.toString().padStart(2, '0');
      };
    
      return (
        date.getFullYear() + '-' +
        padTo2Digits(date.getMonth() + 1) + '-' +
        padTo2Digits(date.getDate()) + ' ' +
        padTo2Digits(date.getHours()) + ':' +
        padTo2Digits(date.getMinutes()) + ':' +
        padTo2Digits(date.getSeconds())
      );
    };

    if (results[0].count === 0) {
      db.query(
        `INSERT INTO users (nome, data_nascimento, email, senha, telefone, papel, createdAt, numero, cep)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "Administrador",
          "2000-01-01",
          "phss15@discente.ifpe.edu.br",
          "$2b$10$iuXflZD2n.dY6UHt7MyCVOaJN6wQZFvkIFS3cH0YLlCe3xCBt/DtO",
          "+5581997528011",
          "Administrador",
          formatDateForMySQL(new Date()),
          "10",
          "100"
        ],
        (err) => {
          if (err) {
            console.error('Erro ao criar administrador:', err.message);
            return;
          }
          console.log('Administrador criado com sucesso.');
        }
      );
    } else {
      console.log('A tabela já contém dados. Nenhuma inserção foi realizada.');
    }
  }); 
};

createAdminIfTableEmpty(); 

// Rotas

// Listar todos os usuários
app.get('/api/users', (req, res) => {
  db.query('SELECT * FROM users WHERE papel = "Cliente"', (err, results) => {
  // db.query('SELECT * FROM users WHERE papel = "Administrador"', (err, results) => {
    if (err) {
      res.status(500).send(err.message);
      return;
    }
    res.json(results);
  });
});

// Listar todos os usuários 
app.get('/api/products', (req, res) => {
  db.query('SELECT * FROM products', (err, results) => {
    if (err) {
      res.status(500).send(err.message);
      return;
    }
    res.json(results);
  });
});
 
// Buscar um usuário pelo ID
app.get('/api/users/:id', (req, res) => {
  const id = req.params.id;
  db.query('SELECT * FROM users WHERE id = ?', [id], (err, result) => {
    if (err) {
      res.status(500).send(err.message);
      return;
    }
    if (result.length === 0) {
      res.status(404).send('Usuário não encontrado');
      return;
    }
    res.json(result[0]);
  });
});

// Criar um novo usuário
app.post('/api/users', (req, res) => {
  const { nome, email, senha, nascimento, telefone, CEP, createdAt, numero } = req.body;

    // Criptografar a senha
    bcrypt.hash(senha, saltRounds, (err, hash) => {
      if (err) {
        console.error("Erro ao criptografar a senha:", err.message);
        res.status(500).send(err.message);
        return;
      }
  
  const sql = 'INSERT INTO users (nome, email, senha, data_nascimento, telefone, cep, createdAt, numero, papel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "Cliente")';
  const values = [nome, email, hash, nascimento, telefone, CEP, createdAt, numero];
  
  db.query(sql, values, (err, result) => { 
    if (err) {
      console.error("Erro ao inserir usuário:", err.message);
      res.status(500).send(err.message);
      return;
    }
    res.status(201).json({ id: result.insertId });
  })
  });
});

// Endpoint para login de usuários
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;

  const sql = 'SELECT senha FROM users WHERE email = ?';
  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error("Erro ao buscar usuário:", err.message);
      res.status(500).send(err.message);
      return;
    }

    if (results.length === 0) {
      res.status(401).send('Usuário não encontrado');
      return;
    }

    const hashedPassword = results[0].senha;

    bcrypt.compare(senha, hashedPassword, (err, isMatch) => {
      if (err) {
        console.error("Erro ao comparar senhas:", err.message);
        res.status(500).send(err.message);
        return;
      }

      if (isMatch) {
        res.status(200).send('Login bem-sucedido');
      } else {
        res.status(401).send('Senha incorreta');
      }
    });
  });
});

// Atualizar um usuário existente
app.put('/api/users/:id', (req, res) => {
  const id = req.params.id;
  const { nome, idade, email, apelido, telefone } = req.body;
  db.query('UPDATE users SET nome = ?, idade = ?, email = ?, apelido = ?, telefone = ? WHERE id = ?', [nome, idade, email, apelido, telefone, id], (err, result) => {
    if (err) {
      res.status(500).send(err.message);
      return;
    }
    if (result.affectedRows === 0) {
      res.status(404).send('Usuário não encontrado');
      return;
    }
    res.sendStatus(204);
  });
});

// Deletar um usuário
app.delete('/api/users/:id', (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM users WHERE id = ?', [id], (err, result) => {
    if (err) {
      res.status(500).send(err.message);
      return;
    }
    if (result.affectedRows === 0) {
      res.status(404).send('Usuário não encontrado');
      return;
    }
    res.sendStatus(204);
  });
});

app.listen(PORT, () => {
  console.log(`O servidor está rodando em http://localhost:${PORT}`);
}); 