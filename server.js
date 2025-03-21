const express = require('express');
const twilio = require('twilio');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// Configuración de Twilio
const accountSid = 'AC23d870e91af9e3c0a1cced7478060880';
const authToken = '5c05e2d9508998574b3f0a22cd66686c';
const client = new twilio(accountSid, authToken);

app.post('/send-sms', async (req, res) => {
  const { to, message } = req.body;

  try {
    await client.messages.create({
      body: message,
      from: '+12084237177', // Número de Twilio
      to: to
    });
    res.status(200).send('SMS enviado');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al enviar SMS');
  }
});

app.listen(3000, () => console.log('Servidor en puerto 3000'));