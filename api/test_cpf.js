import axios from 'axios';
axios.get('http://192.168.0.176:4000/api/customer/by-cpf/00000000000')
  .then(res => console.log('Sucesso:', res.data))
  .catch(err => console.log('Erro:', err.response ? err.response.data : err.message));
