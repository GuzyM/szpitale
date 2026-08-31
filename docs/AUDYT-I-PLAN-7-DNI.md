# HospitalAPP — audyt i plan wersji testerskiej

Stan audytu: 31.08.2026

## Decyzja produktowa

HospitalAPP ma być prostym narzędziem pracy dla osób zarządzających szpitalami. Pierwsza wersja skupia się na pięciu działających obszarach: Gruper JGP, Legislacja MZ, Rachunek kosztów, Skutki wzrostu płac i zmiana UD439.

Na ten etap wyłączono z interfejsu: Przetargi, Świadczenia NFZ, Analizę wyników i Umowy NFZ. Powrót tych modułów ma sens dopiero po zaprojektowaniu osobnych źródeł danych i odpowiedzialności za ich aktualność.

## Wniosek z audytu

PWA nie jest „podglądzikiem” z definicji. Może być pełnoprawną aplikacją instalowaną na telefonie i komputerze. Problemem poprzedniej wersji nie była technologia PWA, tylko brak niezawodnego procesu aktualizacji danych, zbyt szeroki zakres produktu oraz słabe zabezpieczenie procesu publikacji.

Najpoważniejszy wykryty błąd dotyczył Grupera: aplikacja korzystała z zarządzenia 46/2026/DSOZ i 702 grup, mimo że zarządzenie 74/2026/DSOZ wprowadziło nowe katalogi 1a i 1ae. W starym katalogu pozostawały grupy usunięte, m.in. N09, N11 i N13.

## Stan techniczny po przebudowie 1.2

| Obszar | Stan | Ocena |
|---|---|---|
| Gruper JGP | 748 grup, katalogi 1a i 1ae, 39 306 pozycji ICD | Gotowy do testów użytkowników |
| Pobyt do 12 godzin | Osobny tryb na podstawie katalogu 1ae | Gotowy, wymaga testów przypadków klinicznych |
| Legislacja MZ | 91 pozycji; 80 aktywnych z oficjalnego wykazu MZ | Gotowa do testów |
| Rachunek kosztów | Wyszukiwarka rozporządzenia i 20 pytań | Gotowy |
| Kalkulator płac | 10 grup zawodowych | Gotowy |
| UD439 | 9 obszarów zarządczych | Gotowy, wymaga okresowej weryfikacji prawnej |
| Przetargi | Wyłączone | Poza zakresem wersji 1 |
| Świadczenia NFZ | Wyłączone | Poza zakresem wersji 1 |
| Analiza wyników | Wyłączona | Poza zakresem wersji 1 |
| Umowy NFZ | Wyłączone | Poza zakresem wersji 1 |

## Architektura — czego naprawdę potrzeba

Wersja dla znajomych nie potrzebuje jeszcze logowania ani Supabase, ponieważ używa publicznych danych, a ustawienia i kalkulacje mogą zostać na urządzeniu użytkownika. Dodanie bazy tylko po to, aby aplikacja „wyglądała poważnie”, zwiększyłoby ryzyko i czas pracy bez wartości dla testera.

Docelowy układ powinien mieć cztery warstwy:

1. Interfejs PWA — wyszukiwanie, kalkulacje i praca offline.
2. Import danych — automaty pobierające oficjalne pliki NFZ i MZ.
3. Walidacja — testy liczby rekordów, zmian grup, kompletności i dat źródeł.
4. Publikacja — wdrożenie dopiero po przejściu testów, z możliwością powrotu do poprzedniej wersji.

Backend z PostgreSQL/Supabase należy dodać, gdy pojawi się przynajmniej jedna realna potrzeba: konta użytkowników, synchronizacja danych między urządzeniami, prywatne dane szpitala, panel administratora lub współdzielone notatki. Wtedy obowiązkowe będą autentykacja, role, RLS, kopie zapasowe, rejestr zmian i monitoring.

## Najważniejsze ryzyka

| Priorytet | Ryzyko | Działanie |
|---|---|---|
| Krytyczne | NFZ zmieni katalog, a aplikacja nadal pokaże stary | Automat importu + test daty i numeru zarządzenia |
| Krytyczne | Użytkownik potraktuje kalkulację jako wynik rozliczeniowy | Widoczne źródło, data i zastrzeżenie; testy na realnych przypadkach |
| Wysokie | Publikacja błędnej wersji bez testów | CI blokuje wdrożenie, gdy testy nie przechodzą |
| Wysokie | Jednoplikowy app.js utrudni rozwój | Po wersji testerskiej podział na moduły |
| Średnie | Brak analityki błędów użytkowników | Prosty kanał zgłoszeń i anonimowy monitoring w kolejnym sprincie |
| Średnie | Brak ochrony gałęzi main | Włączyć branch protection i obowiązkowy przegląd zmian |

## Plan vibecodowania — 7 dni, około 2 godziny dziennie

### Dzień 1 — zakres i wydanie 1.2

- Opublikować uproszczoną wersję.
- Wybrać 3–5 znajomych pracujących z rozliczeniami lub controllingiem.
- Wysłać jedno zadanie testowe: znaleźć grupę, sprawdzić warunki, policzyć wartość.

Efekt: aplikacja działa pod publicznym adresem, a testerzy wiedzą, co sprawdzić.

### Dzień 2 — prawdziwe przypadki JGP

- Zebrać 10 anonimowych przypadków testowych bez danych pacjentów.
- Porównać grupy, punkty i warunki z systemem szpitalnym lub oficjalnym arkuszem.
- Zapisać każde odstępstwo jako błąd z kodem grupy.

Efekt: wiemy, czy Gruper pomaga w realnej pracy, a nie tylko poprawnie wyświetla dane.

### Dzień 3 — import NFZ

- Rozdzielić pobieranie, konwersję i walidację plików.
- Dodać testy grup dodanych i usuniętych oraz liczby pozycji.
- Przygotować raport różnic przed każdą aktualizacją.

Efekt: zmiana NFZ nie trafia do aplikacji bez kontroli.

### Dzień 4 — legislacja

- Ograniczyć listę do zmian istotnych dla zarządzania szpitalem.
- Dodać tematy: finansowanie, kadry, jakość, sprawozdawczość, organizacja.
- Ustalić, które streszczenia są oficjalne, a które przygotowuje HospitalAPP.

Efekt: moduł staje się filtrem zarządczym, a nie długą listą aktów.

### Dzień 5 — bezpieczeństwo i publikacja

- Włączyć ochronę main i obowiązkowe testy przed publikacją.
- Dodać kontrolę nagłówków bezpieczeństwa w docelowym hostingu.
- Spisać procedurę wycofania błędnej wersji.

Efekt: jedna błędna zmiana nie psuje aplikacji wszystkim testerom.

### Dzień 6 — informacja zwrotna

- Przejrzeć zgłoszenia testerów.
- Naprawić maksymalnie trzy problemy o największym wpływie.
- Nie dodawać nowego modułu.

Efekt: pierwsza iteracja wynika z użycia, a nie z kolejnych pomysłów.

### Dzień 7 — decyzja o wersji 1.3

- Ocenić: poprawność, szybkość wykonania zadania, zrozumiałość i chęć ponownego użycia.
- Wybrać jeden cel na następny tydzień.
- Podjąć decyzję o backendzie dopiero na podstawie potrzeb testerów.

Efekt: jasny backlog i decyzja „co dalej”, bez ponownego rozdmuchiwania zakresu.

## Kryteria sukcesu wersji testerskiej

- 10/10 przypadków JGP zgodnych ze źródłem lub jasno wyjaśnionych.
- Tester znajduje grupę i kalkulację w mniej niż 60 sekund.
- Każdy ekran pokazuje źródło i wersję danych.
- Brak błędów blokujących instalację i pracę offline.
- Co najmniej 3 testerów wykona pełne zadanie bez instruktażu autora.

Pierwszy tydzień ma udowodnić jedną rzecz: HospitalAPP skraca konkretną pracę z JGP i legislacją. Dopiero potem dokładamy konta, prywatne dane i kolejne moduły.
