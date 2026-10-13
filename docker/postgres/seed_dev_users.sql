-- Usuarios de prueba, uno por rol. SOLO DESARROLLO: el docker-compose.yml de desarrollo monta
-- este archivo; docker-compose.prod.yml no (en producción el primer ADMIN se crea con
-- `python -m app.cli create-admin`). Se ejecuta después de init.sql (orden alfabético), que
-- crea las áreas semilla a las que se asigna cada usuario.
-- Usuarios semilla para pruebas, uno por rol (SOLO desarrollo: cambiar antes de desplegar)
-- Contraseñas: admin_user / admin123, gestor_user / gestor123, auditor_user / auditor123,
-- operador_user / operador123
-- (se guardan como hash bcrypt)
INSERT INTO users (username, email, hashed_password, full_name, role, area_id) VALUES
(
    'admin_user',
    'administrador@mediflow.cl',
    '$2b$12$5ga92VwMZ957OBX9lcuZ6.yl2OQ5LZl5eeMMMNJ8JUT.Eg1JoFzdW',
    'Administrador MediFlow',
    'ADMIN',
    (SELECT id FROM areas WHERE codigo = 'ADMINISTRACION')
),
(
    'gestor_user',
    'gestor.usuarios@mediflow.cl',
    '$2b$12$3i5NK.X9koqnkL5OtOp/.eY44.Q2a/GUs/XQ.GoNAaA7x9vK3IVwe',
    'Gestor de Usuarios MediFlow',
    'GESTOR_USUARIOS',
    (SELECT id FROM areas WHERE codigo = 'ADMINISTRACION')
),
(
    'auditor_user',
    'auditor.clinico@mediflow.cl',
    '$2b$12$WaGpjNNMefR30Icr2MBKZOuLzlK.0UamsmizM4GnUJUwd4czYdoFm',
    'Auditor Clínico MediFlow',
    'AUDITOR_CLINICO',
    (SELECT id FROM areas WHERE codigo = 'AUDITORIA_MEDICA')
),
(
    'operador_user',
    'operador@mediflow.cl',
    '$2b$12$89UxgwqPngSpoTZYVTXM/emJFCSGrd.sfTgcQW46xBzPqjL2pGMEG',
    'Operador de Admisión MediFlow',
    'OPERADOR',
    (SELECT id FROM areas WHERE codigo = 'ADMISION')
)
-- En una base ya poblada, completa el área de los usuarios semilla que aún no la tienen.
ON CONFLICT (username) DO UPDATE SET area_id = EXCLUDED.area_id WHERE users.area_id IS NULL;

-- Colas de la Consola de Triaje para el auditor y el operador de prueba (el ADMIN ve todas).
INSERT INTO user_queues (user_id, queue_id)
SELECT u.id, q.id
FROM users u
JOIN routing_queues q ON q.codigo IN ('Cola_Emergencia_Medica', 'Gestion_Interconsultas')
WHERE u.username IN ('auditor_user', 'operador_user')
ON CONFLICT DO NOTHING;
