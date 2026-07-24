import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './src/server/db.js';
import { PerfilAcesso } from './src/types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sinalizacoes_secret_key_2026_super_secure';
const PORT = 3000;

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS middleware to support Vercel and Google Cloud Run cross-origin calls
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Vercel Serverless Function path normalization middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // Normalize /api/index prefix if rewrites added it
  if (req.url.startsWith('/api/index')) {
    req.url = req.url.replace('/api/index', '/api');
    if (req.url === '/api' || req.url === '/api/') {
      req.url = '/api/health';
    }
  }
  // If request path is stripped of /api by serverless router, re-attach /api
  if (!req.url.startsWith('/api') && !req.url.startsWith('/uploads') && !req.url.startsWith('/assets')) {
    const isApiRoute =
      req.url.startsWith('/auth') ||
      req.url.startsWith('/sinalizacoes') ||
      req.url.startsWith('/dashboard') ||
      req.url.startsWith('/usuarios') ||
      req.url.startsWith('/supervisores') ||
      req.url.startsWith('/operadores') ||
      req.url.startsWith('/produtos') ||
      req.url.startsWith('/motivos') ||
      req.url.startsWith('/configuracao-api') ||
      req.url.startsWith('/health');
    if (isApiRoute) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
  }
  next();
});

// Health check endpoint
app.get(['/api/health', '/health'], (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    isVercel: !!process.env.VERCEL || !!process.env.VERCEL_ENV,
    timestamp: new Date().toISOString()
  });
});

// Ensure uploads folder exists
const isVercelEnv = !!process.env.VERCEL || !!process.env.VERCEL_ENV;
const uploadsDir = isVercelEnv ? '/tmp/uploads' : path.join(process.cwd(), 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create uploads directory:', e);
}

// Serve uploads statically
app.use('/uploads', express.static(uploadsDir));

// Multer storage for evidence uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `evidencia-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || ['.jpg', '.jpeg', '.png'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos do tipo JPG, JPEG e PNG são permitidos.'));
    }
  }
});

// Auth Middleware
interface AuthRequest extends Request {
  user?: {
    id: number;
    nome: string;
    login: string;
    perfil: PerfilAcesso;
  };
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado. Faça login novamente.' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Sessão expirada ou inválida.' });
    }
    req.user = user;
    next();
  });
}

function requireRole(roles: PerfilAcesso[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.perfil)) {
      return res.status(403).json({ error: 'Você não possui permissão para realizar esta ação.' });
    }
    next();
  };
}

// --- AUTH ROUTES ---
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    const { login, senha } = body || {};

    if (!login || !senha) {
      return res.status(400).json({ error: 'Informe login e senha.' });
    }

    const user = await db.getUsuarioByLogin(String(login).trim());
    if (!user) {
      return res.status(401).json({ error: 'Login ou senha incorretos.' });
    }

    if (user.status === 'Inativo') {
      return res.status(403).json({ error: 'Usuário bloqueado/inativo no sistema. Procure o Administrador.' });
    }

    let validPassword = false;
    try {
      if (user.senha && user.senha.startsWith('$2')) {
        validPassword = bcrypt.compareSync(String(senha), user.senha);
      } else {
        validPassword = String(senha) === String(user.senha);
      }
    } catch (e) {
      validPassword = String(senha) === String(user.senha);
    }

    if (!validPassword) {
      return res.status(401).json({ error: 'Login ou senha incorretos.' });
    }

    const token = jwt.sign(
      { id: user.id, nome: user.nome, login: user.login, perfil: user.perfil },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      id: user.id,
      nome: user.nome,
      login: user.login,
      perfil: user.perfil,
      status: user.status,
      token
    });
  } catch (err: any) {
    console.error('Login route error:', err);
    return res.status(500).json({ error: `Erro ao autenticar: ${err.message || err}` });
  }
});

app.get('/api/auth/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.getUsuarioById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    return res.json({
      id: user.id,
      nome: user.nome,
      login: user.login,
      perfil: user.perfil,
      status: user.status,
      produto: user.produto,
      supervisor: user.supervisor
    });
  } catch (err: any) {
    console.error('Auth/me route error:', err);
    return res.status(500).json({ error: 'Erro ao carregar dados do usuário.' });
  }
});

app.put('/api/auth/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { senhaAtual, novaSenha } = req.body || {};

    if (!novaSenha || String(novaSenha).trim().length < 3) {
      return res.status(400).json({ error: 'Informe uma nova senha válida (mínimo 3 caracteres).' });
    }

    const userId = req.user!.id;
    const user = await db.getUsuarioById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (senhaAtual) {
      let validPassword = false;
      try {
        if (user.senha && user.senha.startsWith('$2')) {
          validPassword = bcrypt.compareSync(String(senhaAtual), user.senha);
        } else {
          validPassword = String(senhaAtual) === String(user.senha);
        }
      } catch (e) {
        validPassword = String(senhaAtual) === String(user.senha);
      }

      if (!validPassword) {
        return res.status(400).json({ error: 'Senha atual incorreta.' });
      }
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(String(novaSenha).trim(), salt);

    const updated = await db.updateUsuario(userId, { senha: hashedPassword });
    if (!updated) {
      return res.status(500).json({ error: 'Erro ao atualizar senha no banco de dados.' });
    }

    return res.json({ message: 'Senha alterada com sucesso!' });
  } catch (err: any) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: `Erro ao alterar senha: ${err.message || err}` });
  }
});

// --- SINALIZAÇÕES ROUTES ---
app.get('/api/sinalizacoes', authenticateToken, async (req: Request, res: Response) => {
  const { dataInicial, dataFinal, supervisor, operador, produto, motivo } = req.query;

  let list = await db.getSinalizacoes();

  if (dataInicial && typeof dataInicial === 'string') {
    list = list.filter((s) => s.data >= dataInicial);
  }
  if (dataFinal && typeof dataFinal === 'string') {
    list = list.filter((s) => s.data <= dataFinal);
  }
  if (supervisor && typeof supervisor === 'string' && supervisor !== 'Todos') {
    list = list.filter((s) => s.supervisor.toLowerCase() === supervisor.toLowerCase());
  }
  if (operador && typeof operador === 'string' && operador !== 'Todos') {
    list = list.filter((s) => s.operador.toLowerCase().includes(operador.toLowerCase()));
  }
  if (produto && typeof produto === 'string' && produto !== 'Todos') {
    list = list.filter((s) => s.produto.toLowerCase() === produto.toLowerCase());
  }
  if (motivo && typeof motivo === 'string' && motivo !== 'Todos') {
    list = list.filter((s) => s.motivo.toLowerCase() === motivo.toLowerCase());
  }

  return res.json(list);
});

app.post(
  '/api/sinalizacoes',
  authenticateToken,
  requireRole(['Administrador', 'Planejamento']),
  upload.single('evidencia'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { operador, supervisor, produto, motivo, observacao } = req.body;

      if (!operador || !supervisor || !produto || !motivo) {
        return res.status(400).json({ error: 'Por favor, preencha todos os campos obrigatórios.' });
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const currentDate = `${year}-${month}-${day}`;

      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const currentTime = `${hours}:${minutes}:${seconds}`;

      let nome_evidencia = '';
      let caminho_evidencia = '';

      if (req.file) {
        nome_evidencia = req.file.originalname;
        caminho_evidencia = `/uploads/${req.file.filename}`;
      }

      const newRecord = await db.addSinalizacao({
        data: currentDate,
        hora: currentTime,
        operador,
        supervisor,
        produto,
        motivo,
        observacao: observacao || '',
        nome_evidencia,
        caminho_evidencia,
        usuario_responsavel: req.user!.nome,
        data_cadastro: now.toISOString()
      });

      return res.status(201).json({
        message: 'Sinalização registrada com sucesso.',
        data: newRecord
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao registrar sinalização.' });
    }
  }
);

app.put(
  '/api/sinalizacoes/:id/confirmar',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID de sinalização inválido.' });
      }

      const list = await db.getSinalizacoes();
      const sinalizacao = list.find((s) => s.id === id);
      if (!sinalizacao) {
        return res.status(404).json({ error: 'Sinalização não encontrada.' });
      }

      const currentUser = req.user!;
      const isMentionedSupervisor =
        sinalizacao.supervisor.toLowerCase().trim() === currentUser.nome.toLowerCase().trim() ||
        sinalizacao.supervisor.toLowerCase().trim() === currentUser.login.toLowerCase().trim();
      const isAdminOrPlan = currentUser.perfil === 'Administrador' || currentUser.perfil === 'Planejamento';

      if (!isAdminOrPlan && !isMentionedSupervisor) {
        return res.status(403).json({
          error: `Apenas o supervisor responsável (${sinalizacao.supervisor}) ou Administrador/Planejamento podem confirmar esta sinalização.`
        });
      }

      const updated = await db.confirmarSinalizacao(id, currentUser.nome);
      if (!updated) {
        return res.status(500).json({ error: 'Erro ao confirmar sinalização.' });
      }

      return res.json({
        message: 'Sinalização confirmada com sucesso.',
        data: updated
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao confirmar sinalização.' });
    }
  }
);

app.delete(
  '/api/sinalizacoes/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de sinalização inválido.' });
    }
    await db.deleteSinalizacao(id);
    return res.json({ success: true, message: 'Sinalização excluída com sucesso.' });
  }
);

// --- DASHBOARD ROUTE ---
app.get('/api/dashboard', authenticateToken, async (req: Request, res: Response) => {
  const { dataInicial, dataFinal, produto, supervisor, operador } = req.query;

  let list = await db.getSinalizacoes();

  if (dataInicial && typeof dataInicial === 'string' && dataInicial) {
    list = list.filter((s) => s.data >= dataInicial);
  }
  if (dataFinal && typeof dataFinal === 'string' && dataFinal) {
    list = list.filter((s) => s.data <= dataFinal);
  }
  if (produto && typeof produto === 'string' && produto !== 'Todos') {
    list = list.filter((s) => s.produto.toLowerCase() === produto.toLowerCase());
  }
  if (supervisor && typeof supervisor === 'string' && supervisor !== 'Todos') {
    list = list.filter((s) => s.supervisor.toLowerCase() === supervisor.toLowerCase());
  }
  if (operador && typeof operador === 'string' && operador !== 'Todos' && operador.trim()) {
    list = list.filter((s) => s.operador.toLowerCase().includes(operador.toLowerCase().trim()));
  }

  // Cards metrics
  const totalSinalizacoes = list.length;
  const operadoresSet = new Set(list.map((s) => s.operador));
  const totalOperadoresSinalizados = operadoresSet.size;

  const supervisoresSet = new Set(list.map((s) => s.supervisor));
  const totalSupervisoresComSinalizacoes = supervisoresSet.size;

  const totalMotivosCadastrados = (await db.getMotivos()).length;

  // Chart 1: Quantidade de sinalizações por Supervisor
  const supCounts: Record<string, number> = {};
  list.forEach((s) => {
    supCounts[s.supervisor] = (supCounts[s.supervisor] || 0) + 1;
  });
  const sinalizacoesPorSupervisor = Object.entries(supCounts).map(([sup, count]) => ({
    supervisor: sup,
    quantidade: count
  })).sort((a, b) => b.quantidade - a.quantidade);

  // Chart 2: Maiores motivos de sinalização
  const motivoCounts: Record<string, number> = {};
  list.forEach((s) => {
    motivoCounts[s.motivo] = (motivoCounts[s.motivo] || 0) + 1;
  });
  const maioresMotivos = Object.entries(motivoCounts).map(([motivo, count]) => ({
    motivo,
    quantidade: count
  })).sort((a, b) => b.quantidade - a.quantidade);

  // Chart 3: Top 5 operadores mais sinalizados
  const opCounts: Record<string, number> = {};
  list.forEach((s) => {
    opCounts[s.operador] = (opCounts[s.operador] || 0) + 1;
  });
  const topOperadores = Object.entries(opCounts)
    .map(([operador, count]) => ({ operador, quantidade: count }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);

  // Chart 4: Quantidade de sinalizações por Produto
  const prodCounts: Record<string, number> = {};
  list.forEach((s) => {
    prodCounts[s.produto] = (prodCounts[s.produto] || 0) + 1;
  });
  const sinalizacoesPorProduto = Object.entries(prodCounts).map(([prod, count]) => ({
    produto: prod,
    quantidade: count
  })).sort((a, b) => b.quantidade - a.quantidade);

  return res.json({
    totalSinalizacoes,
    totalOperadoresSinalizados,
    totalSupervisoresComSinalizacoes,
    totalMotivosCadastrados,
    sinalizacoesPorSupervisor,
    maioresMotivos,
    topOperadores,
    sinalizacoesPorProduto,
    resumoTabela: list
  });
});

// --- USUÁRIOS ROUTES (Admin) ---
app.get(
  '/api/usuarios',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const list = (await db.getUsuarios()).map(({ senha, ...u }) => u);
    return res.json(list);
  }
);

app.post(
  '/api/usuarios',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const { nome, login, senha, perfil, status, produto, supervisor } = req.body;

    if (!nome || !login || !senha || !perfil) {
      return res.status(400).json({ error: 'Nome, login, senha e perfil são obrigatórios.' });
    }

    if (await db.getUsuarioByLogin(login)) {
      return res.status(400).json({ error: 'Já existe um usuário com este login.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(senha, salt);

    const newUser = await db.addUsuario({
      nome,
      login,
      senha: hashedPassword,
      perfil,
      status: status || 'Ativo',
      produto: produto || 'Todos',
      supervisor: supervisor || 'Todos'
    });

    const { senha: _, ...userWithoutPassword } = newUser;
    return res.status(201).json(userWithoutPassword);
  }
);

app.put(
  '/api/usuarios/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { nome, perfil, status, produto, supervisor } = req.body;

    const existing = await db.getUsuarioById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const updated = await db.updateUsuario(id, {
      ...(nome && { nome }),
      ...(perfil && { perfil }),
      ...(status && { status }),
      ...(produto && { produto }),
      ...(supervisor && { supervisor })
    });

    if (!updated) return res.status(404).json({ error: 'Erro ao atualizar.' });

    const { senha: _, ...userWithoutPassword } = updated;
    return res.json(userWithoutPassword);
  }
);

app.put(
  '/api/usuarios/:id/reset-password',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { novaSenha } = req.body;

    if (!novaSenha || novaSenha.length < 3) {
      return res.status(400).json({ error: 'Informe uma nova senha válida (mínimo 3 caracteres).' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(novaSenha, salt);

    const updated = await db.updateUsuario(id, { senha: hashedPassword });
    if (!updated) return res.status(404).json({ error: 'Usuário não encontrado.' });

    return res.json({ message: 'Senha resetada com sucesso.' });
  }
);

app.delete(
  '/api/usuarios/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    await db.deleteUsuario(id);
    return res.json({ message: 'Usuário excluído com sucesso.' });
  }
);

// --- SUPERVISORES ROUTES ---
app.get('/api/supervisores', authenticateToken, async (req: Request, res: Response) => {
  return res.json(await db.getSupervisores());
});

function generateSupervisorLogin(nome: string): string {
  const clean = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'supervisor';
  if (parts.length === 1) return parts[0];
  return `${parts[0]}.${parts[parts.length - 1]}`;
}

app.post(
  '/api/supervisores',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const { nome, produto, status } = req.body;
    if (!nome || !produto) {
      return res.status(400).json({ error: 'Nome e Produto são obrigatórios.' });
    }

    const newSup = await db.addSupervisor({
      nome,
      produto,
      status: status || 'Ativo'
    });

    // Auto-create user for supervisor with login "nome.sobrenome" and password "123456"
    try {
      const baseLogin = generateSupervisorLogin(nome);
      let loginToUse = baseLogin;
      let counter = 1;
      while (await db.getUsuarioByLogin(loginToUse)) {
        loginToUse = `${baseLogin}${counter}`;
        counter++;
      }

      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('123456', salt);

      await db.addUsuario({
        nome,
        login: loginToUse,
        senha: hashedPassword,
        perfil: 'Operação',
        status: status || 'Ativo',
        produto: produto || 'Todos',
        supervisor: nome
      });
    } catch (err) {
      console.warn('Erro ao criar usuário automático para o supervisor:', err);
    }

    return res.status(201).json(newSup);
  }
);

app.put(
  '/api/supervisores/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { nome, produto, status } = req.body;

    const updated = await db.updateSupervisor(id, {
      ...(nome && { nome }),
      ...(produto && { produto }),
      ...(status && { status })
    });

    if (!updated) return res.status(404).json({ error: 'Supervisor não encontrado.' });
    return res.json(updated);
  }
);

app.delete(
  '/api/supervisores/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    await db.deleteSupervisor(id);
    return res.json({ message: 'Supervisor excluído com sucesso.' });
  }
);

// --- OPERADORES ROUTES ---
app.get('/api/operadores', authenticateToken, async (req: Request, res: Response) => {
  return res.json(await db.getOperadores());
});

// --- PRODUTOS ROUTES ---
app.get('/api/produtos', authenticateToken, async (req: Request, res: Response) => {
  return res.json(await db.getProdutos());
});

app.post(
  '/api/produtos',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome do produto é obrigatório.' });
    const prod = await db.addProduto(nome);
    return res.status(201).json(prod);
  }
);

app.put(
  '/api/produtos/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome do produto é obrigatório.' });
    const updated = await db.updateProduto(id, nome);
    if (!updated) return res.status(404).json({ error: 'Produto não encontrado.' });
    return res.json(updated);
  }
);

app.delete(
  '/api/produtos/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    await db.deleteProduto(id);
    return res.json({ message: 'Produto excluído com sucesso.' });
  }
);

// --- MOTIVOS ROUTES ---
app.get('/api/motivos', authenticateToken, async (req: Request, res: Response) => {
  return res.json(await db.getMotivos());
});

app.post(
  '/api/motivos',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const { descricao } = req.body;
    if (!descricao) return res.status(400).json({ error: 'Descrição é obrigatória.' });
    const newMotivo = await db.addMotivo(descricao);
    return res.status(201).json(newMotivo);
  }
);

app.put(
  '/api/motivos/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { descricao } = req.body;
    if (!descricao) return res.status(400).json({ error: 'Descrição é obrigatória.' });
    const updated = await db.updateMotivo(id, descricao);
    if (!updated) return res.status(404).json({ error: 'Motivo não encontrado.' });
    return res.json(updated);
  }
);

app.delete(
  '/api/motivos/:id',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    await db.deleteMotivo(id);
    return res.json({ message: 'Motivo excluído com sucesso.' });
  }
);

// --- CONFIGURAÇÃO DE API & SINCRONIZAÇÃO ROUTES ---
app.get(
  '/api/config-api',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const config = await db.getConfigApi();
    return res.json({ ...config, senha: '••••••••••••' });
  }
);

app.post(
  '/api/config-api',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const { url_api, token, usuario, senha } = req.body;
    const updated = await db.updateConfigApi({
      url_api,
      token,
      usuario,
      ...(senha && senha !== '••••••••••••' && { senha })
    });
    return res.json({ message: 'Configuração de API salva com sucesso.', data: updated });
  }
);

app.post(
  '/api/config-api/test',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const { url_api } = req.body;
    if (!url_api) {
      return res.status(400).json({ success: false, message: 'URL da API não informada.' });
    }
    try {
      const config = await db.getConfigApi();
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };
      if (config.token) {
        headers['Authorization'] = config.token.startsWith('Bearer ') ? config.token : `Bearer ${config.token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url_api, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return res.json({
          success: true,
          message: `Conexão com a API (${url_api}) estabelecida com sucesso (HTTP ${response.status} ${response.statusText}).`
        });
      } else {
        return res.status(400).json({
          success: false,
          message: `A API respondeu com código de erro HTTP ${response.status} ${response.statusText}.`
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: `Erro ao tentar conectar à API (${url_api}): ${err.message || 'Falha de conexão'}`
      });
    }
  }
);

app.post(
  '/api/config-api/sync',
  authenticateToken,
  requireRole(['Administrador']),
  async (req: Request, res: Response) => {
    const config = await db.getConfigApi();
    if (!config.url_api) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma URL de API configurada. Por favor, salve uma URL válida em Configuração da API.'
      });
    }

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };
      if (config.token) {
        headers['Authorization'] = config.token.startsWith('Bearer ') ? config.token : `Bearer ${config.token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(config.url_api, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(400).json({
          success: false,
          message: `A API respondeu com erro HTTP ${response.status} ${response.statusText}`
        });
      }

      const apiData = await response.json();

      let opCount = 0;
      let supCount = 0;
      let prodCount = 0;

      if (apiData) {
        const ops = Array.isArray(apiData)
          ? apiData
          : apiData.operadores || apiData.colaboradores || apiData.users || [];
        const sups = apiData.supervisores || [];
        const prods = apiData.produtos || [];

        if (Array.isArray(prods)) {
          for (const p of prods) {
            const nomeProd = typeof p === 'string' ? p : p.nome || p.description;
            if (nomeProd) {
              await db.addProduto(nomeProd);
              prodCount++;
            }
          }
        }

        if (Array.isArray(sups)) {
          for (const s of sups) {
            if (s.nome) {
              const existingSups = await db.getSupervisores();
              const found = existingSups.find(x => x.nome.toLowerCase() === s.nome.toLowerCase());
              if (!found) {
                await db.addSupervisor({
                  nome: s.nome,
                  produto: s.produto || 'Geral',
                  status: s.status || 'Ativo'
                });
                supCount++;
              }
            }
          }
        }

        if (Array.isArray(ops)) {
          for (const o of ops) {
            const nomeOp = typeof o === 'string' ? o : o.nome || o.name;
            if (nomeOp) {
              const existingOps = await db.getOperadores();
              const found = existingOps.find(x => x.nome.toLowerCase() === nomeOp.toLowerCase());
              if (!found) {
                await db.addOperador({
                  nome: nomeOp,
                  produto: o.produto || 'Geral',
                  supervisor: o.supervisor || 'Geral',
                  situacao: o.situacao || 'Ativo'
                });
                opCount++;
              }
            }
          }
        }
      }

      const now = new Date();
      const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      await db.updateConfigApi({ ultima_sincronizacao: formattedDate });

      return res.json({
        success: true,
        message: 'Sincronização com a API aplicada realizada com sucesso!',
        detalhes: {
          operadoresAtualizados: opCount,
          supervisoresAtualizados: supCount,
          produtosSincronizados: prodCount,
          dataSincronizacao: formattedDate
        }
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: `Erro ao conectar à API (${config.url_api}): ${err.message || 'Falha de conexão'}`
      });
    }
  }
);

// Global Express Error Handler Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Express global error handler:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message || 'Erro interno do servidor.' });
  }
});

// Vite middleware / Express static setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  startServer();
}

export default app;
