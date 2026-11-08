-- Starter list of schools (users can pick "Other"; admins approve new names).
insert into public.schools (name, country) values
  ('Sorbonne Université', 'FR'),
  ('Université Paris Dauphine-PSL', 'FR'),
  ('HEC Paris', 'FR'),
  ('ESSEC', 'FR'),
  ('ESCP', 'FR'),
  ('EDHEC', 'FR'),
  ('emlyon', 'FR'),
  ('Sciences Po', 'FR'),
  ('École polytechnique', 'FR'),
  ('INSEAD', 'FR'),
  ('London School of Economics', 'GB'),
  ('Imperial College London', 'GB'),
  ('University of Oxford', 'GB'),
  ('University of Cambridge', 'GB'),
  ('Bocconi', 'IT'),
  ('St. Gallen', 'CH'),
  ('IE Business School', 'ES'),
  ('Wharton', 'US'),
  ('Columbia', 'US'),
  ('NYU Stern', 'US')
on conflict (name) do nothing;
