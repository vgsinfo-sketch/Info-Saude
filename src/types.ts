export interface Anexo {
  id: string;
  nome: string;
  url?: string; // Optional if using Storage
  path?: string; // Optional if using Storage
  content?: string; // Base64 content for Firestore storage
  data: string;
  tipo: 'laudo' | 'receita';
}

export interface Usuario {
  uid: string; // Firebase Auth UID
  id: string; // ID do cartão (ex: INFO-001)
  nome_completo: string;
  cpf: string;
  cartao_sus?: string;
  tipo_sanguineo?: string;
  alergias?: string;
  medicamentos?: string;
  condicoes_preexistentes?: string;
  ultima_vacina?: string;
  contatos_emergencia?: string;
  telefone?: string;
  observacoes?: string;
  role?: 'user' | 'admin';
  data_nascimento?: string;
  sexo?: string;
  condicoes?: string;
  contato_emergencia_nome?: string;
  contato_emergencia_tel?: string;
  email?: string;
  plano_saude_nome?: string;
  plano_saude_numero?: string;
  plano_saude_tipo?: string;
  anexos?: Anexo[];
  data_cadastro?: string;
  data_validade?: string;
  foto?: string; // Base64 string for profile photo
}
