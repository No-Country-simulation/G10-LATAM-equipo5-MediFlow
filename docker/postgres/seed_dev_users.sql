-- Usuarios de prueba, uno por rol. SOLO DESARROLLO: el docker-compose.yml de desarrollo monta
-- este archivo; docker-compose.prod.yml no (en producción el primer ADMIN se crea con
-- `python -m app.cli create-admin`). Se ejecuta después de init.sql (orden alfabético).
-- Usuarios semilla para pruebas, uno por rol (SOLO desarrollo: cambiar antes de desplegar)
-- Contraseñas: admin_user / admin123, gestor_user / gestor123, auditor_user / auditor123,
-- operador_user / operador123
-- (se guardan como hash bcrypt)
INSERT INTO users (username, email, hashed_password, full_name, role) VALUES
(
    'admin_user',
    'administrador@mediflow.cl',
    '$2b$12$5ga92VwMZ957OBX9lcuZ6.yl2OQ5LZl5eeMMMNJ8JUT.Eg1JoFzdW',
    'Administrador MediFlow',
    'ADMIN'
),
(
    'gestor_user',
    'gestor.usuarios@mediflow.cl',
    '$2b$12$3i5NK.X9koqnkL5OtOp/.eY44.Q2a/GUs/XQ.GoNAaA7x9vK3IVwe',
    'Gestor de Usuarios MediFlow',
    'GESTOR_USUARIOS'
),
(
    'auditor_user',
    'auditor.clinico@mediflow.cl',
    '$2b$12$WaGpjNNMefR30Icr2MBKZOuLzlK.0UamsmizM4GnUJUwd4czYdoFm',
    'Auditor Clínico MediFlow',
    'AUDITOR_CLINICO'
),
(
    'operador_user',
    'operador@mediflow.cl',
    '$2b$12$89UxgwqPngSpoTZYVTXM/emJFCSGrd.sfTgcQW46xBzPqjL2pGMEG',
    'Operador de Admisión MediFlow',
    'OPERADOR'
)
ON CONFLICT (username) DO NOTHING;
