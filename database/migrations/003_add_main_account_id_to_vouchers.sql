-- Add main_account_id to payment_vouchers and receipt_vouchers
-- This column tracks the cash/bank account used in the voucher for balance updates

ALTER TABLE payment_vouchers
  ADD COLUMN IF NOT EXISTS main_account_id INT NULL,
  ADD CONSTRAINT fk_pv_main_account FOREIGN KEY (main_account_id) REFERENCES accounts(account_id);

ALTER TABLE receipt_vouchers
  ADD COLUMN IF NOT EXISTS main_account_id INT NULL,
  ADD CONSTRAINT fk_rv_main_account FOREIGN KEY (main_account_id) REFERENCES accounts(account_id);
