# Architektura danych HospitalAPP

Status: decyzja obowiązująca od 22.07.2026 r.

## Wybrany model

HospitalAPP jest aplikacją PWA typu **local-first**:

- publiczne dane referencyjne są wersjonowane w repozytorium i publikowane jako statyczne pliki JSON/JavaScript,
- automatyczne aktualizacje wykonuje GitHub Actions bez używania modeli AI,
- ustawienia użytkownika i własne kalkulacje pozostają lokalnie na urządzeniu,
- aplikacja działa offline po pierwszym pełnym uruchomieniu.

Ten model obejmuje obecnie dane JGP, charakterystykę grup, publiczne reguły współczynników, referencyjny profil umowy NFZ oraz legislację MZ.

## Dlaczego bez Supabase

Na obecnym etapie aplikacja udostępnia głównie publiczne dane tylko do odczytu. Baza i konto w zewnętrznej usłudze nie przyniosłyby użytkownikowi istotnej korzyści, a zwiększyłyby liczbę elementów wymagających konfiguracji i utrzymania.

Plik JSON jest tekstowym, ustrukturyzowanym zbiorem rekordów. Aplikacja pobiera go tak samo jak pozostałe pliki strony. Git zachowuje historię każdej zmiany, a GitHub Pages publikuje aktualną wersję.

## Kiedy dokładamy bazę

Bazę PostgreSQL, np. Supabase, rozważamy dopiero po wystąpieniu co najmniej jednej z potrzeb:

1. konta i logowanie użytkowników,
2. synchronizacja własnych danych między urządzeniami,
3. współdzielenie danych w zespole,
4. zapis danych tworzonych przez użytkowników po stronie serwera,
5. panel administracyjny z edycją danych bez zmian w repozytorium,
6. skala lub częstotliwość zmian, przy której pobieranie plików statycznych przestaje być praktyczne.

Dane publiczne mogą nadal pozostać w plikach nawet po dodaniu bazy dla danych użytkowników.

## Zasady rozwoju

- Warstwa interfejsu nie może zależeć od szczegółów miejsca przechowywania danych.
- Każdy zbiór publiczny ma metadane źródła, datę sprawdzenia i link do dokumentu oficjalnego.
- Automaty nie kasują ostatniej poprawnej wersji danych po błędzie źródła.
- Dane wrażliwe, bankowe, medyczne i własne kalkulacje nie trafiają do publicznego repozytorium.
- AI może przygotowywać podsumowania w osobnym etapie, ale pobieranie i aktualizacja danych działa zwykłym kodem.
