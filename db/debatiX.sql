DROP DATABASE IF EXISTS debatiX;
CREATE DATABASE debatiX CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE debatiX;

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  user_password VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email_verified BOOLEAN DEFAULT FALSE,
  register_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_security (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  secret_2fa VARCHAR(255) DEFAULT NULL,
  attempts INT DEFAULT 5,
  register_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_security_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id INT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_user_roles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_roles_role
    FOREIGN KEY (role_id) REFERENCES roles(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO roles (name) VALUES ('ADMIN'), ('USER');

CREATE TABLE password_resets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token_hash (token_hash),
  CONSTRAINT fk_password_resets_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE email_verifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ev_token_hash (token_hash),
  INDEX idx_ev_user (user_id),
  INDEX idx_ev_expires (expires_at),
  CONSTRAINT fk_email_ver_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE questions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  text VARCHAR(500) NOT NULL,
  option_a VARCHAR(150) NOT NULL,
  option_b VARCHAR(150) NOT NULL,
  published_date DATE NOT NULL,
  status ENUM('scheduled','active','closed','archived') NOT NULL DEFAULT 'scheduled',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_questions_unique_day UNIQUE (published_date),
  INDEX idx_questions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE answers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  side ENUM('A','B') NOT NULL,
  body VARCHAR(280) NOT NULL,
  likes_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_answers_q (question_id),
  INDEX idx_answers_user (user_id),
  INDEX idx_answers_side (side),
  INDEX idx_answers_q_side_likes (question_id, side, likes_count DESC),
  UNIQUE KEY uq_answers_user_once_per_question (question_id, user_id),
  CONSTRAINT fk_answers_question
    FOREIGN KEY (question_id) REFERENCES questions(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_answers_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE answer_likes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  answer_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_like_once (answer_id, user_id),
  INDEX idx_likes_user (user_id),
  CONSTRAINT fk_likes_answer
    FOREIGN KEY (answer_id) REFERENCES answers(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_likes_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DELIMITER $$
CREATE TRIGGER trg_answer_likes_after_insert
AFTER INSERT ON answer_likes FOR EACH ROW
BEGIN
  UPDATE answers
  SET likes_count = likes_count + 1
  WHERE id = NEW.answer_id;
END$$

CREATE TRIGGER trg_answer_likes_after_delete
AFTER DELETE ON answer_likes FOR EACH ROW
BEGIN
  UPDATE answers
  SET likes_count = GREATEST(likes_count - 1, 0)
  WHERE id = OLD.answer_id;
END$$
DELIMITER ;

CREATE TABLE participations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_participation_once (user_id, question_id),
  INDEX idx_participations_user (user_id),
  INDEX idx_participations_question (question_id),
  CONSTRAINT fk_participations_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_participations_question
    FOREIGN KEY (question_id) REFERENCES questions(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_stats (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  total_xp DECIMAL(8,1) NOT NULL DEFAULT 0.0,
  influence_total INT UNSIGNED NOT NULL DEFAULT 0,
  power_majority_hits INT UNSIGNED NOT NULL DEFAULT 0,
  power_participations INT UNSIGNED NOT NULL DEFAULT 0,
  power_pct DECIMAL(5,2) AS (
    CASE
      WHEN power_participations = 0
      THEN 0
      ELSE ROUND(power_majority_hits * 100.0 / power_participations, 2)
    END
  ) STORED,
  streak_days INT UNSIGNED NOT NULL DEFAULT 0,
  last_participation_date DATE NULL,
  weekly_grace_tokens TINYINT UNSIGNED NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_stats_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE daily_user_influence (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  likes_sum INT UNSIGNED NOT NULL DEFAULT 0,
  rank_position INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_daily_user (question_id, user_id),
  INDEX idx_daily_q (question_id),
  INDEX idx_daily_rank (question_id, rank_position),
  CONSTRAINT fk_dui_question
    FOREIGN KEY (question_id) REFERENCES questions(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_dui_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE OR REPLACE VIEW v_top_answers_by_side AS
SELECT
  a.question_id,
  a.side,
  a.id AS answer_id,
  a.user_id,
  a.likes_count,
  a.body,
  ROW_NUMBER() OVER (
    PARTITION BY a.question_id, a.side
    ORDER BY a.likes_count DESC, a.id ASC
  ) AS side_rank
FROM answers a;

CREATE OR REPLACE VIEW v_global_influence_ranking AS
SELECT 
  u.id AS user_id,
  CONCAT(u.first_name, ' ', u.last_name) AS user_name,
  s.influence_total,
  DENSE_RANK() OVER (ORDER BY s.influence_total DESC, u.id ASC) AS rank_position
FROM users u
JOIN user_stats s ON s.user_id = u.id;
