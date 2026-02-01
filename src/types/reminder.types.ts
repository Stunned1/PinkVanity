export type Reminder = {
  readonly id: string;
  readonly user_id: string;
  readonly phone_number: string;
  readonly message: string;
  readonly remind_at: string;
  readonly status: string | null;
  readonly created_at: string | null;
  readonly frequency: number;
};
