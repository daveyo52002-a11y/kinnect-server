INSERT INTO users (name, email, password_hash, role) VALUES
('Demo User', 'user@example.com', 'hashedpassword123', 'customer'),
('Admin User', 'admin@example.com', 'hashedpassword123', 'moderator')
ON CONFLICT (email) DO NOTHING;

INSERT INTO movies (title, genre_id, director, year, duration, description, poster_url, rating, stock_count) VALUES
('Interstellar', 5, 'Christopher Nolan', 2014, '2h 49m', 'A team travels through a wormhole in search of a new home for humanity.', NULL, 8.7, 5),
('The Wolf of Wall Street', 2, 'Martin Scorsese', 2013, '3h 0m', 'The rise and fall of stockbroker Jordan Belfort.', NULL, 8.2, 4),
('Goodfellas', 4, 'Martin Scorsese', 1990, '2h 26m', 'The story of Henry Hill and his life in the mob.', NULL, 8.7, 3),
('Joker', 2, 'Todd Phillips', 2019, '2h 2m', 'A troubled man descends into madness and becomes the Joker.', NULL, 8.4, 5),
('Oppenheimer', 2, 'Christopher Nolan', 2023, '3h 0m', 'The story of J. Robert Oppenheimer and the creation of the atomic bomb.', NULL, 8.3, 6),
('Marty Supreme', 2, 'Josh Safdie', 2025, NULL, 'A sports drama centered around competitive table tennis.', NULL, NULL, 2),
('Titanic', 7, 'James Cameron', 1997, '3h 14m', 'A romance unfolds aboard the ill-fated Titanic.', NULL, 7.9, 4),
('Project X', 3, 'Nima Nourizadeh', 2012, '1h 28m', 'A high school party spirals out of control.', NULL, 6.7, 3),
('Good Will Hunting', 2, 'Gus Van Sant', 1997, '2h 6m', 'A janitor at MIT has a hidden genius for mathematics.', NULL, 8.3, 5),
('Avatar', 5, 'James Cameron', 2009, '2h 42m', 'A marine on an alien planet becomes torn between two worlds.', NULL, 7.9, 6),
('Taxi Driver', 2, 'Martin Scorsese', 1976, '1h 54m', 'A lonely Vietnam veteran works as a nighttime taxi driver in New York City.', NULL, 8.2, 2),
('The Dark Knight', 1, 'Christopher Nolan', 2008, '2h 32m', 'Batman faces the Joker in Gotham City.', NULL, 9.0, 5),
('Get Out', 6, 'Jordan Peele', 2017, '1h 44m', 'A man uncovers disturbing secrets while visiting his girlfriend’s family.', NULL, 7.8, 3),
('Superbad', 3, 'Greg Mottola', 2007, '1h 53m', 'Two friends try to enjoy their last days of high school.', NULL, 7.6, 4)
ON CONFLICT DO NOTHING;

INSERT INTO rentals (user_id, movie_id, expiry_date)
VALUES (1, 1, NOW() + INTERVAL '7 days')
ON CONFLICT DO NOTHING;