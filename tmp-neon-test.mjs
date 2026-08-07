import 'dotenv/config';
import { db } from './src/server/neon.js';

(async () => {
  try {
    const usuarios = await db.getUsuarios();
    console.log('usuarios count', usuarios.length, usuarios.slice(0, 3));
    const produtos = await db.getProdutos();
    console.log('produtos count', produtos.length, produtos.slice(0, 3));
    const motivos = await db.getMotivos();
    console.log('motivos count', motivos.length, motivos.slice(0, 3));
    const supervisores = await db.getSupervisores();
    console.log('supervisores count', supervisores.length, supervisores.slice(0, 3));
    const operadores = await db.getOperadores();
    console.log('operadores count', operadores.length, operadores.slice(0, 3));
    const sinalizacoes = await db.getSinalizacoes();
    console.log('sinalizacoes count', sinalizacoes.length, sinalizacoes.slice(0, 3));
  } catch (err) {
    console.error('error', err);
  }
})();