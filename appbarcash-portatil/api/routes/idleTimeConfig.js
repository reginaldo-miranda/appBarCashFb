import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// GET /api/idle-time-config
router.get("/", async (req, res) => {
  try {
    // Tenta buscar a primeira configuração existente
    let config = await prisma.idleTimeConfig.findFirst();

    // Se não existir, cria uma padrão
    if (!config) {
      config = await prisma.idleTimeConfig.create({
        data: {
          ativo: false,
          usarHoraInclusao: true,
          estagios: JSON.stringify([
            { tempo: "00:15:00", cor: "#FFFF00" }, // Amarelo
            { tempo: "00:30:00", cor: "#FFA500" }, // Laranja
            { tempo: "00:45:00", cor: "#FF4500" }, // Vermelho laranja
            { tempo: "01:00:00", cor: "#FF0000" }, // Vermelho
          ]),
        },
      });
    }

    res.json(config);
  } catch (error) {
    console.error("Erro ao buscar configuração de tempo ocioso:", error);
    res.status(500).json({ error: "Erro ao buscar configuração." });
  }
});

// POST /api/idle-time-config
router.post("/", async (req, res) => {
  try {
    const { ativo, usarHoraInclusao, estagios } = req.body;

    // Busca o ID da configuração existente (assumindo que só há uma)
    const existingConfig = await prisma.idleTimeConfig.findFirst();

    let config;
    if (existingConfig) {
      config = await prisma.idleTimeConfig.update({
        where: { id: existingConfig.id },
        data: {
          ativo,
          usarHoraInclusao,
          estagios: JSON.stringify(estagios), // Garante que seja salvo como string JSON se o banco exigir, ou JSON direto dependendo do Prisma
        },
      });
    } else {
      config = await prisma.idleTimeConfig.create({
        data: {
          ativo,
          usarHoraInclusao,
          estagios: JSON.stringify(estagios),
        },
      });
    }

    res.json(config);
  } catch (error) {
    console.error("Erro ao salvar configuração de tempo ocioso:", error);
    res.status(500).json({ error: "Erro ao salvar configuração." });
  }
});

export default router;
