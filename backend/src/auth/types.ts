export interface AuthedRequestUser {
  id: number;
  email: string;
  name: string;
  role:
    | 'superadmin'
    | 'pwd_admin'
    | 'jalboard_admin'
    | 'municipal_admin'
    | 'disco_admin'
    | 'spcb_admin'
    | 'sma_admin'
    | 'public_user';
  department: string | null;
}

export interface SafeUser {
  id: number;
  name: string;
  email: string;
  role: AuthedRequestUser['role'];
  department: string | null;
  createdAt: Date;
  updatedAt: Date;
}
