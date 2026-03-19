-- ─────────────────────────────────────────────────────────────────────────────
-- Ajout d'exercices — à exécuter dans l'éditeur SQL de Supabase
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "public"."exercises" ("id", "name", "muscle_group", "is_bodyweight", "created_at") VALUES

-- ── PECTORAUX ─────────────────────────────────────────────────────────────────
('32', 'Développé couché barre', 'Pectoraux', 'false', NOW()),
('33', 'Développé incliné barre', 'Pectoraux', 'false', NOW()),
('34', 'Développé décliné barre', 'Pectoraux', 'false', NOW()),
('35', 'Développé décliné haltères', 'Pectoraux', 'false', NOW()),
('36', 'Pull-over haltère', 'Pectoraux', 'false', NOW()),
('37', 'Pec deck machine', 'Pectoraux', 'false', NOW()),
('38', 'Push-up lesté', 'Pectoraux', 'true', NOW()),
('39', 'Cable fly bas', 'Pectoraux', 'false', NOW()),
('40', 'Cable fly haut', 'Pectoraux', 'false', NOW()),
('41', 'Dumbbell fly plat', 'Pectoraux', 'false', NOW()),

-- ── ÉPAULES ───────────────────────────────────────────────────────────────────
('42', 'Military press barre', 'Épaules', 'false', NOW()),
('43', 'Shoulder press machine', 'Épaules', 'false', NOW()),
('44', 'Arnold press', 'Épaules', 'false', NOW()),
('45', 'Face pull', 'Épaules', 'false', NOW()),
('46', 'Élévations frontales haltères', 'Épaules', 'false', NOW()),
('47', 'Élévations latérales machine', 'Épaules', 'false', NOW()),
('48', 'Upright row barre', 'Épaules', 'false', NOW()),
('49', 'Oiseau haltères', 'Épaules', 'false', NOW()),
('50', 'Shrug haltères', 'Épaules', 'false', NOW()),
('51', 'Shrug barre', 'Épaules', 'false', NOW()),

-- ── DOS ───────────────────────────────────────────────────────────────────────
('52', 'Soulevé de terre', 'Dos', 'false', NOW()),
('53', 'Traction pronation', 'Dos', 'true', NOW()),
('54', 'Traction supination', 'Dos', 'true', NOW()),
('55', 'Lat pulldown prise large', 'Dos', 'false', NOW()),
('56', 'Lat pulldown prise neutre', 'Dos', 'false', NOW()),
('57', 'Rowing câble assis', 'Dos', 'false', NOW()),
('58', 'Rowing câble prise large', 'Dos', 'false', NOW()),
('59', 'T-bar row', 'Dos', 'false', NOW()),
('60', 'Pull-over poulie', 'Dos', 'false', NOW()),
('61', 'Hyperextension', 'Dos', 'false', NOW()),
('62', 'Good morning', 'Dos', 'false', NOW()),
('63', 'Tirage horizontal machine', 'Dos', 'false', NOW()),

-- ── TRICEPS ───────────────────────────────────────────────────────────────────
('64', 'Dips', 'Triceps', 'true', NOW()),
('65', 'Close grip bench press', 'Triceps', 'false', NOW()),
('66', 'Extension triceps haltère assis', 'Triceps', 'false', NOW()),
('67', 'Kickback haltère', 'Triceps', 'false', NOW()),
('68', 'Extension poulie droite', 'Triceps', 'false', NOW()),
('69', 'Diamond push-up', 'Triceps', 'true', NOW()),
('70', 'JM press', 'Triceps', 'false', NOW()),

-- ── BICEPS ────────────────────────────────────────────────────────────────────
('71', 'Curl barre droite', 'Biceps', 'false', NOW()),
('72', 'Curl incliné haltères', 'Biceps', 'false', NOW()),
('73', 'Curl concentration haltère', 'Biceps', 'false', NOW()),
('74', 'Curl Spider', 'Biceps', 'false', NOW()),
('75', 'Chin-up', 'Biceps', 'true', NOW()),
('76', 'Curl poulie basse prise supination', 'Biceps', 'false', NOW()),

-- ── JAMBES ────────────────────────────────────────────────────────────────────
('77', 'Squat barre', 'Jambes', 'false', NOW()),
('78', 'Squat gobelet', 'Jambes', 'false', NOW()),
('79', 'Hack squat', 'Jambes', 'false', NOW()),
('80', 'Soulevé de terre sumo', 'Jambes', 'false', NOW()),
('81', 'Hip thrust barre', 'Jambes', 'false', NOW()),
('82', 'Step-up haltères', 'Jambes', 'false', NOW()),
('83', 'Leg curl couché', 'Jambes', 'false', NOW()),
('84', 'Adducteur machine', 'Jambes', 'false', NOW()),
('85', 'Abducteur machine', 'Jambes', 'false', NOW()),
('86', 'Walking lunges', 'Jambes', 'false', NOW()),
('87', 'Mollets assis', 'Jambes', 'false', NOW()),
('88', 'Presse à cuisses prise sumo', 'Jambes', 'false', NOW()),
('89', 'Leg press unilatéral', 'Jambes', 'false', NOW()),
('90', 'Squat sauter', 'Jambes', 'true', NOW()),
('91', 'Fente marchée', 'Jambes', 'false', NOW()),

-- ── ABDOS ─────────────────────────────────────────────────────────────────────
('92', 'Planche', 'Abdos', 'true', NOW()),
('93', 'Gainage latéral', 'Abdos', 'true', NOW()),
('94', 'Russian twist', 'Abdos', 'true', NOW()),
('95', 'Leg raise', 'Abdos', 'true', NOW()),
('96', 'Ab wheel', 'Abdos', 'true', NOW()),
('97', 'Bicycle crunch', 'Abdos', 'true', NOW()),
('98', 'V-up', 'Abdos', 'true', NOW()),
('99', 'Dragon flag', 'Abdos', 'true', NOW()),
('100', 'Crunch oblique', 'Abdos', 'true', NOW()),
('101', 'Hollow body', 'Abdos', 'true', NOW()),

-- ── CARDIO ────────────────────────────────────────────────────────────────────
('102', 'Corde à sauter', 'Cardio', 'true', NOW()),
('103', 'Rameur', 'Cardio', 'false', NOW()),
('104', 'Vélo elliptique', 'Cardio', 'false', NOW()),
('105', 'Tapis de course', 'Cardio', 'false', NOW()),
('106', 'Burpees', 'Cardio', 'true', NOW()),
('107', 'Vélo stationnaire', 'Cardio', 'false', NOW()),
('108', 'Box jump', 'Cardio', 'true', NOW())

ON CONFLICT (id) DO NOTHING;
