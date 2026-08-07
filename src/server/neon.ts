import pkg from "pg";
const { Pool } = pkg;

import bcrypt from "bcryptjs";

import {
  Usuario,
  Supervisor,
  Operador,
  Produto,
  Motivo,
  Sinalizacao,
  ConfiguracaoApi,
  DiarioBordoOcorrencia,
  DiarioBordoHistorico
} from "../types.js";

import { getBrasiliaFullString } from "../utils/dateUtils.js";
import {
  getLocalConfigApi,
  getLocalMotivos,
  getLocalOperadores,
  getLocalProdutos,
  getLocalSinalizacoes,
  getLocalSupervisores,
  getLocalUsuarios,
  getLocalUsuarioByLogin,
  getLocalUsuarioById,
  saveLocalConfigApi,
  saveLocalSinalizacao,
  updateLocalSinalizacao
} from "./localDb.js";

const connectionString = process.env.DATABASE_URL || "";
const schemaName = process.env.PG_SCHEMA || 'public';

console.log("DATABASE_URL:", connectionString);
console.log("PG_SCHEMA:", schemaName);

export const pool = new Pool({
  connectionString,
  ssl: false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

async function setSearchPath(client: any) {
  if (schemaName) {
    await client.query(`SET search_path TO ${schemaName}, public`);
  }
}

const originalPoolQuery = pool.query.bind(pool);

pool.query = async (...args: any[]) => {
  const client = await pool.connect();
  try {
    await setSearchPath(client);
    return await client.query(...args);
  } finally {
    client.release();
  }
};

pool.on("connect", () => {
  console.log("✅ PostgreSQL conectado.");
});

pool.on("error", (err) => {
  console.error("Erro PostgreSQL:", err);
});

async function dbQuery(text: string, params: any[] = []) {
  const client = await pool.connect();

  try {
    await setSearchPath(client);
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export const db = {
  getUsuarios: async (): Promise<Usuario[]> => {
    try {
        const { rows } = await dbQuery(
            `SELECT * FROM usuarios ORDER BY id`
        );

        return rows as Usuario[];
    } catch (err) {
        console.warn("[PostgreSQL] Falling back to local users data:", err);
        return getLocalUsuarios();
    }
    },

  getUsuarioByLogin: async (login: string): Promise<Usuario | undefined> => {
    try {

        const { rows } = await dbQuery(
            `SELECT * FROM usuarios
             WHERE LOWER(login)=LOWER($1)
             LIMIT 1`,
            [login]
        );

        return rows[0];

    } catch (err) {
        console.warn("Falling back to local auth data for login lookup:", err);
        const localUser = getLocalUsuarioByLogin(login);
        if (!localUser) return undefined;

        return {
          id: localUser.id,
          nome: localUser.nome,
          login: localUser.login,
          senha: localUser.senha,
          perfil: localUser.perfil,
          status: localUser.status,
          produto: localUser.produto || 'Todos',
          supervisor: localUser.supervisor || 'Todos'
        } as Usuario;
    }
  },

  getUsuarioById: async (id: number): Promise<Usuario | undefined> => {

    try {

        const { rows } = await dbQuery(

            `SELECT *
             FROM usuarios
             WHERE id=$1`,

            [id]

        );

        return rows[0];

    } catch (err) {
        console.warn("Falling back to local auth data for user lookup:", err);
        const localUser = getLocalUsuarioById(id);
        if (!localUser) return undefined;

        return {
          id: localUser.id,
          nome: localUser.nome,
          login: localUser.login,
          senha: localUser.senha,
          perfil: localUser.perfil,
          status: localUser.status,
          produto: localUser.produto || 'Todos',
          supervisor: localUser.supervisor || 'Todos'
        } as Usuario;

    }
  },
  addUsuario: async (data: Omit<Usuario, "id">): Promise<Usuario> => {

    const { rows } = await dbQuery(

        `INSERT INTO usuarios
        (
            nome,
            login,
            senha,
            perfil,
            status,
            produto,
            supervisor
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *`,

        [
            data.nome,
            data.login,
            data.senha,
            data.perfil,
            data.status,
            data.produto || "Todos",
            data.supervisor || "Todos"
        ]

    );

    return rows[0];

  },
  updateUsuario: async (
    id: number,
    data: Partial<Usuario>
): Promise<Usuario | null> => {

    const atual = await db.getUsuarioById(id);

    if (!atual)
        return null;

    const { rows } = await dbQuery(

        `UPDATE usuarios
        SET

            nome=$1,
            login=$2,
            senha=$3,
            perfil=$4,
            status=$5,
            produto=$6,
            supervisor=$7

        WHERE id=$8

        RETURNING *`,

        [

            data.nome ?? atual.nome,
            data.login ?? atual.login,
            data.senha ?? atual.senha,
            data.perfil ?? atual.perfil,
            data.status ?? atual.status,
            data.produto ?? atual.produto,
            data.supervisor ?? atual.supervisor,

            id

        ]

    );

    return rows[0];

  },
  deleteUsuario: async (id: number): Promise<void> => {

    await dbQuery(

        `DELETE FROM usuarios
         WHERE id=$1`,

        [id]

    );
  },

  getSupervisores: async (): Promise<Supervisor[]> => {
    try {

        const { rows } = await dbQuery(
            `SELECT *
             FROM supervisores
             ORDER BY id`
        );

        return rows as Supervisor[];

    } catch (err) {

        console.warn("[PostgreSQL] Falling back to local supervisors data:", err);
        return getLocalSupervisores();

    }
  },
  addSupervisor: async (
    data: Omit<Supervisor, "id">
): Promise<Supervisor> => {

    const { rows } = await dbQuery(

        `INSERT INTO supervisores
        (
            nome,
            produto,
            status
        )

        VALUES ($1,$2,$3)

        RETURNING *`,

        [
            data.nome,
            data.produto,
            data.status
        ]

    );

    return rows[0];

  },
  updateSupervisor: async (
    id: number,
    data: Partial<Supervisor>
): Promise<Supervisor | null> => {

    const { rows: atualRows } = await dbQuery(

        `SELECT *
         FROM supervisores
         WHERE id=$1`,

        [id]

    );

    if (atualRows.length === 0)
        return null;

    const atual = atualRows[0];

    const { rows } = await dbQuery(

        `UPDATE supervisores

        SET

            nome=$1,
            produto=$2,
            status=$3

        WHERE id=$4

        RETURNING *`,

        [

            data.nome ?? atual.nome,
            data.produto ?? atual.produto,
            data.status ?? atual.status,

            id

        ]

    );

    return rows[0];

  },
deleteSupervisor: async (id:number): Promise<void> => {

    await dbQuery(

        `DELETE FROM supervisores
         WHERE id=$1`,

        [id]

    );
  },

getOperadores: async (): Promise<Operador[]> => {

    try {

        const { rows } = await dbQuery(

            `SELECT *
             FROM operadores
             ORDER BY id`

        );

        return rows as Operador[];

    } catch (err) {

        console.warn("[PostgreSQL] Falling back to local operadores data:", err);
        return getLocalOperadores();

    }
  },
addOperador: async (
    data: Omit<Operador,"id">
): Promise<Operador> => {

    const { rows } = await dbQuery(

        `INSERT INTO operadores
        (
            nome,
            produto,
            supervisor,
            situacao
        )

        VALUES ($1,$2,$3,$4)

        RETURNING *`,

        [

            data.nome,
            data.produto,
            data.supervisor,
            data.situacao

        ]

    );

    return rows[0];
  },
updateOperador: async (
    id:number,
    data:Partial<Operador>
): Promise<Operador | null> => {

    const { rows: atualRows } = await dbQuery(

        `SELECT *
         FROM operadores
         WHERE id=$1`,

        [id]

    );

    if(atualRows.length===0)
        return null;

    const atual = atualRows[0];

    const { rows } = await dbQuery(

        `UPDATE operadores

        SET

            nome=$1,
            produto=$2,
            supervisor=$3,
            situacao=$4

        WHERE id=$5

        RETURNING *`,

        [

            data.nome ?? atual.nome,
            data.produto ?? atual.produto,
            data.supervisor ?? atual.supervisor,
            data.situacao ?? atual.situacao,

            id

        ]

    );

    return rows[0];

  },
  getProdutos: async (): Promise<Produto[]> => {
  try {
    const result = await pool.query(
      `SELECT * FROM produtos ORDER BY id ASC`
    );

    return result.rows as Produto[];
  } catch (err) {
    console.warn('[PostgreSQL] Falling back to local products data:', err);
    return getLocalProdutos();
  }
},
deleteOperador: async (id: number): Promise<void> => {
  try {
    await pool.query(
      `DELETE FROM operadores
       WHERE id = $1`,
      [id]
    );
  } catch (err) {
    console.error('[PostgreSQL] Error in deleteOperador:', err);
    throw err;
  }
},

addProduto: async (nome: string): Promise<Produto> => {
  try {
    const lowerName = nome.toLowerCase();

    // Verifica se o produto já existe
    const existing = await pool.query(
      `SELECT * FROM produtos
       WHERE LOWER(nome) = $1
       LIMIT 1`,
      [lowerName]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0] as Produto;
    }

    // Insere o novo produto
    const result = await pool.query(
      `INSERT INTO produtos (nome)
       VALUES ($1)
       RETURNING *`,
      [nome]
    );

    return result.rows[0] as Produto;
  } catch (err) {
    console.error('[PostgreSQL] Error in addProduto:', err);
    throw err;
  }
},

updateProduto: async (id: number, nome: string): Promise<Produto | null> => {
  try {
    const result = await pool.query(
      `UPDATE produtos
       SET nome = $1
       WHERE id = $2
       RETURNING *`,
      [nome, id]
    );

    return result.rows.length > 0
      ? (result.rows[0] as Produto)
      : null;
  } catch (err) {
    console.error('[PostgreSQL] Error in updateProduto:', err);
    return null;
  }
},

deleteProduto: async (id: number): Promise<void> => {
  try {
    await pool.query(
      `DELETE FROM produtos
       WHERE id = $1`,
      [id]
    );
  } catch (err) {
    console.error('[PostgreSQL] Error in deleteProduto:', err);
    throw err;
  }
},

getMotivos: async (): Promise<Motivo[]> => {
  try {
    const result = await pool.query(
      `SELECT * FROM motivos
       ORDER BY id ASC`
    );

    return result.rows as Motivo[];
  } catch (err) {
    console.warn('[PostgreSQL] Falling back to local motivos data:', err);
    return getLocalMotivos();
  }
},

  addMotivo: async (descricao: string): Promise<Motivo> => {
  try {
    const result = await pool.query(
      `INSERT INTO motivos (descricao)
       VALUES ($1)
       RETURNING *`,
      [descricao]
    );

    return result.rows[0] as Motivo;
  } catch (err) {
    console.error('[PostgreSQL] Error in addMotivo:', err);
    throw err;
  }
},

updateMotivo: async (id: number, descricao: string): Promise<Motivo | null> => {
  try {
    const result = await pool.query(
      `UPDATE motivos
       SET descricao = $1
       WHERE id = $2
       RETURNING *`,
      [descricao, id]
    );

    return result.rows.length > 0
      ? (result.rows[0] as Motivo)
      : null;
  } catch (err) {
    console.error('[PostgreSQL] Error in updateMotivo:', err);
    return null;
  }
},

deleteMotivo: async (id: number): Promise<void> => {
  try {
    await pool.query(
      `DELETE FROM motivos
       WHERE id = $1`,
      [id]
    );
  } catch (err) {
    console.error('[PostgreSQL] Error in deleteMotivo:', err);
    throw err;
  }
},

getSinalizacoes: async (): Promise<Sinalizacao[]> => {
  try {
    const result = await pool.query(
      `SELECT * FROM sinalizacoes
       ORDER BY id DESC`
    );

    return result.rows as Sinalizacao[];
  } catch (err) {
    console.warn('[PostgreSQL] Falling back to local signal data:', err);
    return getLocalSinalizacoes();
  }
},

addSinalizacao: async (
  data: Omit<Sinalizacao, 'id'>
): Promise<Sinalizacao> => {
  try {
    const gravidade = data.gravidade || 'Médio';
    const observacao = data.observacao || '';
    const nomeEvidencia = data.nome_evidencia || '';
    const caminhoEvidencia = data.caminho_evidencia || '';

    const result = await pool.query(
      `INSERT INTO sinalizacoes (
          data,
          hora,
          operador,
          supervisor,
          produto,
          motivo,
          gravidade,
          observacao,
          nome_evidencia,
          caminho_evidencia,
          usuario_responsavel,
          data_cadastro
       )
       VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12
       )
       RETURNING *`,
      [
        data.data,
        data.hora,
        data.operador,
        data.supervisor,
        data.produto,
        data.motivo,
        gravidade,
        observacao,
        nomeEvidencia,
        caminhoEvidencia,
        data.usuario_responsavel,
        data.data_cadastro,
      ]
    );

    return result.rows[0] as Sinalizacao;
  } catch (err) {
    console.warn('[PostgreSQL] Falling back to local signal create:', err);
    const newItem = {
      id: Date.now(),
      data: data.data,
      hora: data.hora,
      operador: data.operador,
      supervisor: data.supervisor,
      produto: data.produto,
      motivo: data.motivo,
      gravidade: data.gravidade || 'Médio',
      observacao: data.observacao || '',
      nome_evidencia: data.nome_evidencia || '',
      caminho_evidencia: data.caminho_evidencia || '',
      usuario_responsavel: data.usuario_responsavel || '',
      data_cadastro: data.data_cadastro || new Date().toISOString(),
      confirmado: false,
      data_confirmacao: '',
      usuario_confirmacao: ''
    } as Sinalizacao;
    return saveLocalSinalizacao(newItem);
  }
},

deleteSinalizacao: async (id: number): Promise<void> => {
  try {
    await pool.query(
      `DELETE FROM sinalizacoes
       WHERE id = $1`,
      [id]
    );
  } catch (err) {
    console.error('[PostgreSQL] Error in deleteSinalizacao:', err);
    throw err;
  }
},

  updateSinalizacao: async (
  id: number,
  data: Partial<Sinalizacao>
): Promise<Sinalizacao | null> => {
  try {
    // Busca o registro atual
    const currentResult = await pool.query(
      `SELECT * FROM sinalizacoes
       WHERE id = $1`,
      [id]
    );

    if (currentResult.rows.length === 0) {
      return null;
    }

    const current = currentResult.rows[0];

    const operador = data.operador ?? current.operador;
    const supervisor = data.supervisor ?? current.supervisor;
    const produto = data.produto ?? current.produto;
    const motivo = data.motivo ?? current.motivo;
    const gravidade = data.gravidade ?? current.gravidade ?? 'Médio';
    const observacao = data.observacao ?? current.observacao;
    const nome_evidencia = data.nome_evidencia ?? current.nome_evidencia;
    const caminho_evidencia = data.caminho_evidencia ?? current.caminho_evidencia;

    const result = await pool.query(
      `UPDATE sinalizacoes
       SET
         operador = $1,
         supervisor = $2,
         produto = $3,
         motivo = $4,
         gravidade = $5,
         observacao = $6,
         nome_evidencia = $7,
         caminho_evidencia = $8
       WHERE id = $9
       RETURNING *`,
      [
        operador,
        supervisor,
        produto,
        motivo,
        gravidade,
        observacao,
        nome_evidencia,
        caminho_evidencia,
        id,
      ]
    );

    return result.rows.length > 0
      ? (result.rows[0] as Sinalizacao)
      : null;
  } catch (err) {
    console.warn('[PostgreSQL] Falling back to local signal update:', err);
    return updateLocalSinalizacao(id, {
      operador: data.operador,
      supervisor: data.supervisor,
      produto: data.produto,
      motivo: data.motivo,
      gravidade: data.gravidade,
      observacao: data.observacao,
      nome_evidencia: data.nome_evidencia,
      caminho_evidencia: data.caminho_evidencia,
    });
  }
},

confirmarSinalizacao: async (
  id: number,
  usuario_confirmacao: string
): Promise<Sinalizacao | null> => {
  try {
    const data_confirmacao = getBrasiliaFullString(new Date());

    const result = await pool.query(
      `UPDATE sinalizacoes
       SET
         confirmado = TRUE,
         data_confirmacao = $1,
         usuario_confirmacao = $2
       WHERE id = $3
       RETURNING *`,
      [
        data_confirmacao,
        usuario_confirmacao,
        id
      ]
    );

    return result.rows.length > 0
      ? (result.rows[0] as Sinalizacao)
      : null;
  } catch (err) {
    console.warn('[PostgreSQL] Falling back to local signal confirmation:', err);
    return updateLocalSinalizacao(id, {
      confirmado: true,
      data_confirmacao: getBrasiliaFullString(new Date()),
      usuario_confirmacao: usuario_confirmacao,
    });
  }
},

getConfigApi: async (): Promise<ConfiguracaoApi> => {
  const defaultConfig: ConfiguracaoApi = {
    id: 1,
    url_api: '',
    token: '',
    usuario: '',
    senha: '',
    ultima_sincronizacao: ''
  };

  try {
    const result = await pool.query(
      `SELECT *
       FROM configuracao_api
       ORDER BY id ASC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      const insertResult = await pool.query(
        `INSERT INTO configuracao_api
          (id, url_api, token, usuario, senha, ultima_sincronizacao)
         VALUES
          ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [1, '', '', '', '', '']
      );

      return insertResult.rows[0] as ConfiguracaoApi;
    }

    return result.rows[0] as ConfiguracaoApi;
  } catch (err) {
    console.warn('[PostgreSQL] Falling back to local config api data:', err);
    return getLocalConfigApi();
  }
},

 updateConfigApi: async (
  data: Partial<ConfiguracaoApi>
): Promise<ConfiguracaoApi> => {
  try {
    const current = await db.getConfigApi();

    const url_api = data.url_api ?? current.url_api;
    const token = data.token ?? current.token;
    const usuario = data.usuario ?? current.usuario;
    const senha = data.senha ?? current.senha;
    const ultima_sincronizacao =
      data.ultima_sincronizacao ?? current.ultima_sincronizacao;

    const result = await pool.query(
      `UPDATE configuracao_api
       SET
         url_api = $1,
         token = $2,
         usuario = $3,
         senha = $4,
         ultima_sincronizacao = $5
       WHERE id = $6
       RETURNING *`,
      [
        url_api,
        token,
        usuario,
        senha,
        ultima_sincronizacao,
        current.id,
      ]
    );

    return result.rows[0] as ConfiguracaoApi;
  } catch (err) {
    console.warn('[PostgreSQL] Falling back to local config api update:', err);
    return saveLocalConfigApi(data);
  }
},

  // DIÁRIO DE BORDO METHODS
 getDiarioBordo: async (): Promise<DiarioBordoOcorrencia[]> => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM diario_bordo
       ORDER BY id DESC`
    );

    return result.rows as DiarioBordoOcorrencia[];
  } catch (err) {
    console.error('[PostgreSQL] Error in getDiarioBordo:', err);
    return [];
  }
},

getDiarioBordoById: async (
  id: number
): Promise<DiarioBordoOcorrencia | null> => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM diario_bordo
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    return result.rows.length > 0
      ? (result.rows[0] as DiarioBordoOcorrencia)
      : null;
  } catch (err) {
    console.error('[PostgreSQL] Error in getDiarioBordoById:', err);
    return null;
  }
},

addDiarioBordo: async (
  data: Omit<DiarioBordoOcorrencia, 'id'>
): Promise<DiarioBordoOcorrencia> => {
  try {
    const comentario = data.comentario || '';
    const nomeEvidencia = data.nome_evidencia || '';
    const caminhoEvidencia = data.caminho_evidencia || '';
    const dataSolucao = data.data_solucao || '';
    const horaSolucao = data.hora_solucao || '';
    const solucao = data.solucao || '';
    const responsavelSolucao = data.responsavel_solucao || '';

    const result = await pool.query(
      `INSERT INTO diario_bordo (
        data_ocorrencia,
        hora_ocorrencia,
        produto,
        ocorrencia,
        impacto,
        comentario,
        status,
        responsavel,
        nome_evidencia,
        caminho_evidencia,
        data_solucao,
        hora_solucao,
        solucao,
        responsavel_solucao,
        usuario_registro,
        data_cadastro,
        data_atualizacao
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17
      )
      RETURNING *`,
      [
        data.data_ocorrencia,
        data.hora_ocorrencia,
        data.produto,
        data.ocorrencia,
        data.impacto,
        comentario,
        data.status,
        data.responsavel,
        nomeEvidencia,
        caminhoEvidencia,
        dataSolucao,
        horaSolucao,
        solucao,
        responsavelSolucao,
        data.usuario_registro,
        data.data_cadastro,
        data.data_atualizacao,
      ]
    );

    const newRecord = result.rows[0] as DiarioBordoOcorrencia;

    // Registra automaticamente o histórico
    await db.addDiarioBordoHistorico({
      diario_bordo_id: newRecord.id,
      data_hora: newRecord.data_cadastro,
      usuario: newRecord.usuario_registro,
      tipo_alteracao: 'Criação',
      status_anterior: undefined,
      status_novo: newRecord.status,
      descricao: `Ocorrência: "${newRecord.ocorrencia}"${
        newRecord.comentario
          ? ` • Obs: "${newRecord.comentario}"`
          : ''
      } - Iniciada por ${newRecord.usuario_registro} (Status: ${newRecord.status})`
    });

    return newRecord;
  } catch (err) {
    console.error('[PostgreSQL] Error in addDiarioBordo:', err);
    throw err;
  }
},

updateDiarioBordo: async (
    id: number,
    data: Partial<DiarioBordoOcorrencia>,
    usuarioAtualizacao: string
): Promise<DiarioBordoOcorrencia | null> => {

    const current = await db.getDiarioBordoById(id);
    if (!current) return null;

    const nowStr = getBrasiliaFullString(new Date());

    const data_ocorrencia = data.data_ocorrencia ?? current.data_ocorrencia;
    const hora_ocorrencia = data.hora_ocorrencia ?? current.hora_ocorrencia;
    const produto = data.produto ?? current.produto;
    const ocorrencia = data.ocorrencia ?? current.ocorrencia;
    const impacto = data.impacto ?? current.impacto;
    const comentario = data.comentario ?? current.comentario;
    const status = data.status ?? current.status;
    const responsavel = data.responsavel ?? current.responsavel;
    const nome_evidencia = data.nome_evidencia ?? current.nome_evidencia ?? '';
    const caminho_evidencia = data.caminho_evidencia ?? current.caminho_evidencia ?? '';
    const data_solucao = data.data_solucao ?? current.data_solucao ?? '';
    const hora_solucao = data.hora_solucao ?? current.hora_solucao ?? '';
    const solucao = data.solucao ?? current.solucao ?? '';
    const responsavel_solucao = data.responsavel_solucao ?? current.responsavel_solucao ?? '';

    const result = await dbQuery(
        `UPDATE diario_bordo
         SET
            data_ocorrencia = $1,
            hora_ocorrencia = $2,
            produto = $3,
            ocorrencia = $4,
            impacto = $5,
            comentario = $6,
            status = $7,
            responsavel = $8,
            nome_evidencia = $9,
            caminho_evidencia = $10,
            data_solucao = $11,
            hora_solucao = $12,
            solucao = $13,
            responsavel_solucao = $14,
            data_atualizacao = $15
         WHERE id = $16
         RETURNING *`,
        [
            data_ocorrencia,
            hora_ocorrencia,
            produto,
            ocorrencia,
            impacto,
            comentario,
            status,
            responsavel,
            nome_evidencia,
            caminho_evidencia,
            data_solucao,
            hora_solucao,
            solucao,
            responsavel_solucao,
            nowStr,
            id
        ]
    );

    const updated = result.rows[0];

    let desc = `Atualização realizada por ${usuarioAtualizacao}.`;
    let tipo = 'Atualização';

    if (current.ocorrencia !== ocorrencia) {
        desc += ` Descrição alterada para "${ocorrencia}".`;
        tipo = 'Edição da Descrição';
    }

    if (current.status !== status) {
        desc = `Status alterado de "${current.status}" para "${status}" por ${usuarioAtualizacao}.`;
        tipo = 'Mudança de Status';
    }

    if (!current.solucao && solucao) {
        desc += ` Solução registrada: "${solucao.slice(0, 80)}${solucao.length > 80 ? '...' : ''}".`;
        tipo = 'Solução Registrada';
    }

    await db.addDiarioBordoHistorico({
        diario_bordo_id: id,
        data_hora: nowStr,
        usuario: usuarioAtualizacao,
        tipo_alteracao: tipo,
        status_anterior: current.status,
        status_novo: status,
        descricao: desc
    });

    return updated || null;
},

deleteDiarioBordo: async (id: number): Promise<void> => {

    await dbQuery(
        `DELETE FROM diario_bordo
         WHERE id = $1`,
        [id]
    );

},

getDiarioBordoHistorico: async (
    diario_bordo_id: number
): Promise<DiarioBordoHistorico[]> => {

    const result = await dbQuery(
        `SELECT *
         FROM diario_bordo_historico
         WHERE diario_bordo_id = $1
         ORDER BY id ASC`,
        [diario_bordo_id]
    );

    return result.rows;

},

addDiarioBordoHistorico: async (
    data: Omit<DiarioBordoHistorico, 'id'>
): Promise<DiarioBordoHistorico> => {

    const statusAnt = data.status_anterior || '';
    const statusNov = data.status_novo || '';

    const result = await dbQuery(
        `INSERT INTO diario_bordo_historico (
            diario_bordo_id,
            data_hora,
            usuario,
            tipo_alteracao,
            status_anterior,
            status_novo,
            descricao
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
            data.diario_bordo_id,
            data.data_hora,
            data.usuario,
            data.tipo_alteracao,
            statusAnt,
            statusNov,
            data.descricao
        ]
    );

    return result.rows[0];

}

};
