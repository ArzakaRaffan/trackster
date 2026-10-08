-- Mode shadow inbound (P7): email di-parse & dicatat ke EmailParseLog tanpa menulis Transaction/Income/saldo.
ALTER TYPE "ParseStatus" ADD VALUE 'SHADOW';
