-- MySQL dump 10.13  Distrib 8.4.5, for macos15 (x86_64)
--
-- Host: localhost    Database: appBarCash
-- ------------------------------------------------------
-- Server version	8.4.5

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `appBarCash`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `appBarCash` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `appBarCash`;

--
-- Table structure for table `AppSetting`
--

DROP TABLE IF EXISTS `AppSetting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `AppSetting` (
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `AppSetting`
--

LOCK TABLES `AppSetting` WRITE;
/*!40000 ALTER TABLE `AppSetting` DISABLE KEYS */;
/*!40000 ALTER TABLE `AppSetting` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Caixa`
--

DROP TABLE IF EXISTS `Caixa`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Caixa` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dataAbertura` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `dataFechamento` datetime(3) DEFAULT NULL,
  `valorAbertura` decimal(10,2) NOT NULL,
  `valorFechamento` decimal(10,2) DEFAULT NULL,
  `totalVendas` decimal(10,2) NOT NULL DEFAULT '0.00',
  `totalDinheiro` decimal(10,2) NOT NULL DEFAULT '0.00',
  `totalCartao` decimal(10,2) NOT NULL DEFAULT '0.00',
  `totalPix` decimal(10,2) NOT NULL DEFAULT '0.00',
  `funcionarioAberturaId` int NOT NULL,
  `funcionarioFechamentoId` int DEFAULT NULL,
  `status` enum('aberto','fechado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'aberto',
  `observacoes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `Caixa_funcionarioAberturaId_fkey` (`funcionarioAberturaId`),
  KEY `Caixa_funcionarioFechamentoId_fkey` (`funcionarioFechamentoId`),
  CONSTRAINT `Caixa_funcionarioAberturaId_fkey` FOREIGN KEY (`funcionarioAberturaId`) REFERENCES `Employee` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Caixa_funcionarioFechamentoId_fkey` FOREIGN KEY (`funcionarioFechamentoId`) REFERENCES `Employee` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Caixa`
--

LOCK TABLES `Caixa` WRITE;
/*!40000 ALTER TABLE `Caixa` DISABLE KEYS */;
/*!40000 ALTER TABLE `Caixa` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `CaixaVenda`
--

DROP TABLE IF EXISTS `CaixaVenda`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CaixaVenda` (
  `id` int NOT NULL AUTO_INCREMENT,
  `caixaId` int NOT NULL,
  `vendaId` int NOT NULL,
  `valor` decimal(10,2) NOT NULL,
  `formaPagamento` enum('dinheiro','cartao','pix') COLLATE utf8mb4_unicode_ci NOT NULL,
  `dataVenda` datetime(3) NOT NULL,
  `itensPagos` json DEFAULT NULL,
  `observacoes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `CaixaVenda_caixaId_fkey` (`caixaId`),
  KEY `CaixaVenda_vendaId_fkey` (`vendaId`),
  CONSTRAINT `CaixaVenda_caixaId_fkey` FOREIGN KEY (`caixaId`) REFERENCES `Caixa` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CaixaVenda_vendaId_fkey` FOREIGN KEY (`vendaId`) REFERENCES `Sale` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `CaixaVenda`
--

LOCK TABLES `CaixaVenda` WRITE;
/*!40000 ALTER TABLE `CaixaVenda` DISABLE KEYS */;
/*!40000 ALTER TABLE `CaixaVenda` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Categoria`
--

DROP TABLE IF EXISTS `Categoria`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Categoria` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descricao` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  `dataInclusao` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Categoria_nome_key` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Categoria`
--

LOCK TABLES `Categoria` WRITE;
/*!40000 ALTER TABLE `Categoria` DISABLE KEYS */;
/*!40000 ALTER TABLE `Categoria` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Company`
--

DROP TABLE IF EXISTS `Company`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Company` (
  `id` int NOT NULL AUTO_INCREMENT,
  `razaoSocial` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nomeFantasia` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cnpj` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `inscricaoEstadual` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `inscricaoMunicipal` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logradouro` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numero` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `complemento` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bairro` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cidade` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uf` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cep` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ibge` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefoneSecundario` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `whatsapp` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `regimeTributario` enum('simples_nacional','lucro_presumido','lucro_real') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'simples_nacional',
  `cnae` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contribuinteIcms` tinyint(1) NOT NULL DEFAULT '1',
  `ambienteFiscal` enum('homologacao','producao') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'homologacao',
  `logo` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nomeImpressao` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mensagemRodape` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `serieNfce` int NOT NULL DEFAULT '1',
  `numeroInicialNfce` int NOT NULL DEFAULT '1',
  `respNome` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `respCpf` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `respCargo` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `respTelefone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `respEmail` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plano` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `valorMensalidade` decimal(10,2) DEFAULT NULL,
  `diaVencimento` int DEFAULT NULL,
  `dataInicioCobranca` datetime(3) DEFAULT NULL,
  `status` enum('ativa','bloqueada','cancelada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ativa',
  `formaCobranca` enum('pix','boleto','cartao') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'boleto',
  `emailCobranca` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banco` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `agencia` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `conta` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tipoConta` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chavePix` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dataCadastro` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ultimoPagamento` datetime(3) DEFAULT NULL,
  `proximoVencimento` datetime(3) DEFAULT NULL,
  `diasAtraso` int NOT NULL DEFAULT '0',
  `observacoes` text COLLATE utf8mb4_unicode_ci,
  `updatedAt` datetime(3) NOT NULL,
  `latitude` double DEFAULT NULL,
  `longitude` double DEFAULT NULL,
  `deliveryRadius` double DEFAULT NULL,
  `cashbackPercent` decimal(5,2) NOT NULL DEFAULT '5.00',
  `pointsPerCurrency` decimal(5,2) NOT NULL DEFAULT '1.00',
  `pontosParaResgate` int NOT NULL DEFAULT '0',
  `valorResgate` decimal(10,2) NOT NULL DEFAULT '0.00',
  `csc` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cscId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `certificadoNome` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `certificadoSenha` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `certificadoPath` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `xmlFolder` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Company_cnpj_key` (`cnpj`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Company`
--

LOCK TABLES `Company` WRITE;
/*!40000 ALTER TABLE `Company` DISABLE KEYS */;
/*!40000 ALTER TABLE `Company` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Customer`
--

DROP TABLE IF EXISTS `Customer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Customer` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `endereco` text COLLATE utf8mb4_unicode_ci,
  `cidade` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cep` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cpf` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rg` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dataNascimento` datetime(3) DEFAULT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  `dataInclusao` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `saldoCashback` decimal(10,2) NOT NULL DEFAULT '0.00',
  `pontos` int NOT NULL DEFAULT '0',
  `participaFidelidade` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `Customer_cpf_key` (`cpf`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Customer`
--

LOCK TABLES `Customer` WRITE;
/*!40000 ALTER TABLE `Customer` DISABLE KEYS */;
/*!40000 ALTER TABLE `Customer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `DeliveryRange`
--

DROP TABLE IF EXISTS `DeliveryRange`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `DeliveryRange` (
  `id` int NOT NULL AUTO_INCREMENT,
  `minDist` double NOT NULL,
  `maxDist` double NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `companyId` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `DeliveryRange_companyId_fkey` (`companyId`),
  CONSTRAINT `DeliveryRange_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `DeliveryRange`
--

LOCK TABLES `DeliveryRange` WRITE;
/*!40000 ALTER TABLE `DeliveryRange` DISABLE KEYS */;
/*!40000 ALTER TABLE `DeliveryRange` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Employee`
--

DROP TABLE IF EXISTS `Employee`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Employee` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cpf` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `endereco` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bairro` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cargo` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `salario` decimal(10,2) DEFAULT NULL,
  `dataAdmissao` datetime(3) DEFAULT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  `roleId` int DEFAULT NULL,
  `dataInclusao` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `Employee_roleId_fkey` (`roleId`),
  CONSTRAINT `Employee_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Employee`
--

LOCK TABLES `Employee` WRITE;
/*!40000 ALTER TABLE `Employee` DISABLE KEYS */;
INSERT INTO `Employee` VALUES (1,'gabriel',NULL,NULL,'','','',NULL,0.00,'2026-01-30 00:00:00.000',1,2,'2026-01-30 12:11:32.314'),(2,'elaine',NULL,NULL,'','','',NULL,0.00,'2026-01-30 00:00:00.000',1,2,'2026-01-30 12:15:37.531'),(3,'entregador (boy)',NULL,NULL,'','','',NULL,0.00,'2026-01-30 00:00:00.000',1,3,'2026-01-30 12:18:21.917'),(4,'Administrador',NULL,NULL,NULL,NULL,'(00) 00000-0000','Gerente',0.00,'2026-01-30 12:18:32.877',1,NULL,'2026-01-30 12:18:32.898');
/*!40000 ALTER TABLE `Employee` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `idletimeconfig`
--

DROP TABLE IF EXISTS `idletimeconfig`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `idletimeconfig` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ativo` tinyint(1) NOT NULL DEFAULT '0',
  `usarHoraInclusao` tinyint(1) NOT NULL DEFAULT '1',
  `estagios` json NOT NULL,
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `idletimeconfig`
--

LOCK TABLES `idletimeconfig` WRITE;
/*!40000 ALTER TABLE `idletimeconfig` DISABLE KEYS */;
/*!40000 ALTER TABLE `idletimeconfig` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Mesa`
--

DROP TABLE IF EXISTS `Mesa`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Mesa` (
  `id` int NOT NULL AUTO_INCREMENT,
  `numero` int NOT NULL,
  `nome` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `capacidade` int NOT NULL,
  `status` enum('livre','ocupada','reservada','manutencao') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'livre',
  `vendaAtualId` int DEFAULT NULL,
  `funcionarioResponsavelId` int DEFAULT NULL,
  `nomeResponsavel` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clientesAtuais` int NOT NULL DEFAULT '0',
  `horaAbertura` datetime(3) DEFAULT NULL,
  `observacoes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tipo` enum('interna','externa','vip','reservada','balcao') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'interna',
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Mesa_numero_key` (`numero`),
  UNIQUE KEY `Mesa_vendaAtualId_key` (`vendaAtualId`),
  KEY `Mesa_funcionarioResponsavelId_fkey` (`funcionarioResponsavelId`),
  CONSTRAINT `Mesa_funcionarioResponsavelId_fkey` FOREIGN KEY (`funcionarioResponsavelId`) REFERENCES `Employee` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Mesa_vendaAtualId_fkey` FOREIGN KEY (`vendaAtualId`) REFERENCES `Sale` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Mesa`
--

LOCK TABLES `Mesa` WRITE;
/*!40000 ALTER TABLE `Mesa` DISABLE KEYS */;
/*!40000 ALTER TABLE `Mesa` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Nfce`
--

DROP TABLE IF EXISTS `Nfce`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Nfce` (
  `id` int NOT NULL AUTO_INCREMENT,
  `saleId` int NOT NULL,
  `chave` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `numero` int NOT NULL,
  `serie` int NOT NULL,
  `status` enum('PENDENTE','PROCESSANDO','AUTORIZADA','REJEITADA','CANCELADA','DENEGADA','CONTINGENCIA') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDENTE',
  `ambiente` enum('homologacao','producao') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'homologacao',
  `xml` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `protocolo` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `motivo` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qrCode` text COLLATE utf8mb4_unicode_ci,
  `urlConsulta` text COLLATE utf8mb4_unicode_ci,
  `pdfPath` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Nfce_saleId_key` (`saleId`),
  UNIQUE KEY `Nfce_chave_key` (`chave`),
  CONSTRAINT `Nfce_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Nfce`
--

LOCK TABLES `Nfce` WRITE;
/*!40000 ALTER TABLE `Nfce` DISABLE KEYS */;
/*!40000 ALTER TABLE `Nfce` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `NfceEvent`
--

DROP TABLE IF EXISTS `NfceEvent`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `NfceEvent` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nfceId` int NOT NULL,
  `tipo` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sequencia` int NOT NULL DEFAULT '1',
  `xmlEnvio` text COLLATE utf8mb4_unicode_ci,
  `xmlRetorno` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `motivo` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `protocolo` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `NfceEvent_nfceId_fkey` (`nfceId`),
  CONSTRAINT `NfceEvent_nfceId_fkey` FOREIGN KEY (`nfceId`) REFERENCES `Nfce` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `NfceEvent`
--

LOCK TABLES `NfceEvent` WRITE;
/*!40000 ALTER TABLE `NfceEvent` DISABLE KEYS */;
/*!40000 ALTER TABLE `NfceEvent` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Printer`
--

DROP TABLE IF EXISTS `Printer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Printer` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `modelo` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `driver` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  `dataInclusao` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Printer_nome_key` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Printer`
--

LOCK TABLES `Printer` WRITE;
/*!40000 ALTER TABLE `Printer` DISABLE KEYS */;
/*!40000 ALTER TABLE `Printer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PrintJob`
--

DROP TABLE IF EXISTS `PrintJob`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PrintJob` (
  `id` int NOT NULL AUTO_INCREMENT,
  `saleId` int DEFAULT NULL,
  `productId` int NOT NULL,
  `setorId` int NOT NULL,
  `printerId` int DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('queued','processing','done','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `error` text COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `processedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PrintJob`
--

LOCK TABLES `PrintJob` WRITE;
/*!40000 ALTER TABLE `PrintJob` DISABLE KEYS */;
/*!40000 ALTER TABLE `PrintJob` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Product`
--

DROP TABLE IF EXISTS `Product`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Product` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descricao` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `precoCusto` decimal(10,2) NOT NULL,
  `precoVenda` decimal(10,2) NOT NULL,
  `categoria` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tipo` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grupo` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unidade` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'un',
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  `dadosFiscais` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantidade` int NOT NULL DEFAULT '0',
  `imagem` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tempoPreparoMinutos` int NOT NULL DEFAULT '0',
  `disponivel` tinyint(1) NOT NULL DEFAULT '1',
  `dataInclusao` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ncm` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cest` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cfop` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `csosn` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `icmsSituacao` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `icmsAliquota` decimal(5,2) DEFAULT NULL,
  `origem` int NOT NULL DEFAULT '0',
  `categoriaId` int DEFAULT NULL,
  `groupId` int DEFAULT NULL,
  `tipoId` int DEFAULT NULL,
  `unidadeMedidaId` int DEFAULT NULL,
  `temVariacao` tinyint(1) NOT NULL DEFAULT '0',
  `temTamanhos` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `Product_categoriaId_fkey` (`categoriaId`),
  KEY `Product_groupId_fkey` (`groupId`),
  KEY `Product_tipoId_fkey` (`tipoId`),
  KEY `Product_unidadeMedidaId_fkey` (`unidadeMedidaId`),
  CONSTRAINT `Product_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `Categoria` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Product_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ProductGroup` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Product_tipoId_fkey` FOREIGN KEY (`tipoId`) REFERENCES `Tipo` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Product_unidadeMedidaId_fkey` FOREIGN KEY (`unidadeMedidaId`) REFERENCES `UnidadeMedida` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Product`
--

LOCK TABLES `Product` WRITE;
/*!40000 ALTER TABLE `Product` DISABLE KEYS */;
/*!40000 ALTER TABLE `Product` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductGroup`
--

DROP TABLE IF EXISTS `ProductGroup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductGroup` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descricao` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `icone` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '?',
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  `dataInclusao` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ProductGroup_nome_key` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductGroup`
--

LOCK TABLES `ProductGroup` WRITE;
/*!40000 ALTER TABLE `ProductGroup` DISABLE KEYS */;
/*!40000 ALTER TABLE `ProductGroup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductSetorImpressao`
--

DROP TABLE IF EXISTS `ProductSetorImpressao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductSetorImpressao` (
  `productId` int NOT NULL,
  `setorId` int NOT NULL,
  PRIMARY KEY (`productId`,`setorId`),
  KEY `ProductSetorImpressao_setorId_fkey` (`setorId`),
  CONSTRAINT `ProductSetorImpressao_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ProductSetorImpressao_setorId_fkey` FOREIGN KEY (`setorId`) REFERENCES `SetorImpressao` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductSetorImpressao`
--

LOCK TABLES `ProductSetorImpressao` WRITE;
/*!40000 ALTER TABLE `ProductSetorImpressao` DISABLE KEYS */;
/*!40000 ALTER TABLE `ProductSetorImpressao` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProductSize`
--

DROP TABLE IF EXISTS `ProductSize`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductSize` (
  `id` int NOT NULL AUTO_INCREMENT,
  `productId` int NOT NULL,
  `nome` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `preco` decimal(10,2) NOT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `ProductSize_productId_fkey` (`productId`),
  CONSTRAINT `ProductSize_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductSize`
--

LOCK TABLES `ProductSize` WRITE;
/*!40000 ALTER TABLE `ProductSize` DISABLE KEYS */;
/*!40000 ALTER TABLE `ProductSize` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Role`
--

DROP TABLE IF EXISTS `Role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Role` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descricao` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `permissoes` json NOT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  `dataInclusao` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Role_nome_key` (`nome`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Role`
--

LOCK TABLES `Role` WRITE;
/*!40000 ALTER TABLE `Role` DISABLE KEYS */;
INSERT INTO `Role` VALUES (1,'Gerente','faz tudo no sistema','{\"vendas\": true, \"clientes\": true, \"produtos\": true, \"relatorios\": true, \"funcionarios\": true, \"configuracoes\": true}',1,'2026-01-30 12:09:13.740'),(2,'Vendedor','faz tudo que se refere a vendas','{\"vendas\": true, \"clientes\": false, \"produtos\": true, \"relatorios\": false, \"funcionarios\": false, \"configuracoes\": false}',1,'2026-01-30 12:09:52.151'),(3,'Entregado','faz entrega delivery','{\"vendas\": true, \"clientes\": false, \"produtos\": false, \"relatorios\": false, \"funcionarios\": false, \"configuracoes\": false}',1,'2026-01-30 12:10:20.973');
/*!40000 ALTER TABLE `Role` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Sale`
--

DROP TABLE IF EXISTS `Sale`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Sale` (
  `id` int NOT NULL AUTO_INCREMENT,
  `funcionarioId` int DEFAULT NULL,
  `clienteId` int DEFAULT NULL,
  `mesaId` int DEFAULT NULL,
  `responsavelNome` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responsavelFuncionarioId` int DEFAULT NULL,
  `funcionarioNome` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `funcionarioAberturaNome` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `funcionarioAberturaId` int DEFAULT NULL,
  `entregadorId` int DEFAULT NULL,
  `numeroComanda` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nomeComanda` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tipoVenda` enum('balcao','mesa','delivery','comanda') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'balcao',
  `subtotal` decimal(10,2) NOT NULL,
  `desconto` decimal(10,2) NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `cashbackGerado` decimal(10,2) NOT NULL DEFAULT '0.00',
  `cashbackUsado` decimal(10,2) NOT NULL DEFAULT '0.00',
  `pontosUsados` int NOT NULL DEFAULT '0',
  `formaPagamento` enum('dinheiro','cartao','pix') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'dinheiro',
  `status` enum('aberta','finalizada','cancelada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'aberta',
  `dataVenda` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `dataFinalizacao` datetime(3) DEFAULT NULL,
  `observacoes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tempoPreparoEstimado` int NOT NULL DEFAULT '0',
  `impressaoCozinha` tinyint(1) NOT NULL DEFAULT '0',
  `impressaoBar` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `isDelivery` tinyint(1) NOT NULL DEFAULT '0',
  `deliveryAddress` text COLLATE utf8mb4_unicode_ci,
  `deliveryDistance` double DEFAULT NULL,
  `deliveryFee` decimal(10,2) DEFAULT NULL,
  `deliveryStatus` enum('pending','out_for_delivery','delivered','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  PRIMARY KEY (`id`),
  UNIQUE KEY `Sale_numeroComanda_key` (`numeroComanda`),
  KEY `Sale_clienteId_fkey` (`clienteId`),
  KEY `Sale_funcionarioAberturaId_fkey` (`funcionarioAberturaId`),
  KEY `Sale_funcionarioId_fkey` (`funcionarioId`),
  KEY `Sale_mesaId_fkey` (`mesaId`),
  KEY `Sale_responsavelFuncionarioId_fkey` (`responsavelFuncionarioId`),
  KEY `Sale_entregadorId_fkey` (`entregadorId`),
  CONSTRAINT `Sale_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `Customer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Sale_entregadorId_fkey` FOREIGN KEY (`entregadorId`) REFERENCES `Employee` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Sale_funcionarioAberturaId_fkey` FOREIGN KEY (`funcionarioAberturaId`) REFERENCES `Employee` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Sale_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `Employee` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Sale_mesaId_fkey` FOREIGN KEY (`mesaId`) REFERENCES `Mesa` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Sale_responsavelFuncionarioId_fkey` FOREIGN KEY (`responsavelFuncionarioId`) REFERENCES `Employee` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Sale`
--

LOCK TABLES `Sale` WRITE;
/*!40000 ALTER TABLE `Sale` DISABLE KEYS */;
INSERT INTO `Sale` VALUES (1,4,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mesa',0.00,0.00,0.00,0.00,0.00,0,'dinheiro','aberta','2026-01-30 12:18:32.903',NULL,NULL,0,0,0,'2026-01-30 12:18:32.905','2026-01-30 12:18:32.905',0,NULL,NULL,NULL,'pending');
/*!40000 ALTER TABLE `Sale` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `SaleItem`
--

DROP TABLE IF EXISTS `SaleItem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SaleItem` (
  `id` int NOT NULL AUTO_INCREMENT,
  `saleId` int NOT NULL,
  `productId` int DEFAULT NULL,
  `nomeProduto` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantidade` int NOT NULL,
  `precoUnitario` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendente',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `preparedAt` datetime(3) DEFAULT NULL,
  `preparedById` int DEFAULT NULL,
  `origem` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'default',
  `variacaoOpcoes` json DEFAULT NULL,
  `variacaoRegraPreco` enum('mais_caro','media','fixo') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `variacaoTipo` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `SaleItem_preparedById_fkey` (`preparedById`),
  KEY `SaleItem_productId_fkey` (`productId`),
  KEY `SaleItem_saleId_fkey` (`saleId`),
  CONSTRAINT `SaleItem_preparedById_fkey` FOREIGN KEY (`preparedById`) REFERENCES `Employee` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `SaleItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `SaleItem_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `SaleItem`
--

LOCK TABLES `SaleItem` WRITE;
/*!40000 ALTER TABLE `SaleItem` DISABLE KEYS */;
/*!40000 ALTER TABLE `SaleItem` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `SetorImpressao`
--

DROP TABLE IF EXISTS `SetorImpressao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SetorImpressao` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descricao` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `modoEnvio` enum('impressora','whatsapp') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'impressora',
  `whatsappDestino` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  `dataInclusao` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `printerId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `SetorImpressao_nome_key` (`nome`),
  KEY `SetorImpressao_printerId_fkey` (`printerId`),
  CONSTRAINT `SetorImpressao_printerId_fkey` FOREIGN KEY (`printerId`) REFERENCES `Printer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `SetorImpressao`
--

LOCK TABLES `SetorImpressao` WRITE;
/*!40000 ALTER TABLE `SetorImpressao` DISABLE KEYS */;
/*!40000 ALTER TABLE `SetorImpressao` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Tipo`
--

DROP TABLE IF EXISTS `Tipo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Tipo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  `dataInclusao` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `descricao` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Tipo_nome_key` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Tipo`
--

LOCK TABLES `Tipo` WRITE;
/*!40000 ALTER TABLE `Tipo` DISABLE KEYS */;
/*!40000 ALTER TABLE `Tipo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `UnidadeMedida`
--

DROP TABLE IF EXISTS `UnidadeMedida`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `UnidadeMedida` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sigla` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  `dataInclusao` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `descricao` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UnidadeMedida_nome_key` (`nome`),
  UNIQUE KEY `UnidadeMedida_sigla_key` (`sigla`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `UnidadeMedida`
--

LOCK TABLES `UnidadeMedida` WRITE;
/*!40000 ALTER TABLE `UnidadeMedida` DISABLE KEYS */;
/*!40000 ALTER TABLE `UnidadeMedida` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `User`
--

DROP TABLE IF EXISTS `User`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `User` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `senha` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nome` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo` enum('admin','funcionario') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'funcionario',
  `employeeId` int DEFAULT NULL,
  `permissoes` json DEFAULT NULL,
  `roleId` int DEFAULT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  `dataInclusao` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ultimoLogin` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_email_key` (`email`),
  KEY `User_employeeId_fkey` (`employeeId`),
  KEY `User_roleId_fkey` (`roleId`),
  CONSTRAINT `User_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `User`
--

LOCK TABLES `User` WRITE;
/*!40000 ALTER TABLE `User` DISABLE KEYS */;
/*!40000 ALTER TABLE `User` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `VariationType`
--

DROP TABLE IF EXISTS `VariationType`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `VariationType` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `maxOpcoes` int NOT NULL DEFAULT '1',
  `categoriasIds` json DEFAULT NULL,
  `regraPreco` enum('mais_caro','media','fixo') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'mais_caro',
  `precoFixo` decimal(10,2) DEFAULT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  `dataInclusao` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `VariationType_nome_key` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `VariationType`
--

LOCK TABLES `VariationType` WRITE;
/*!40000 ALTER TABLE `VariationType` DISABLE KEYS */;
/*!40000 ALTER TABLE `VariationType` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `WhatsAppMessageLog`
--

DROP TABLE IF EXISTS `WhatsAppMessageLog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `WhatsAppMessageLog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `saleId` int DEFAULT NULL,
  `destino` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('queued','sent','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `error` text COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `sentAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `WhatsAppMessageLog`
--

LOCK TABLES `WhatsAppMessageLog` WRITE;
/*!40000 ALTER TABLE `WhatsAppMessageLog` DISABLE KEYS */;
/*!40000 ALTER TABLE `WhatsAppMessageLog` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-30 10:00:08
