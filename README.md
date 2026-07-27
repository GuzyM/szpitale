# HospitalAPP

HospitalAPP to instalowalna na ekranie początkowym iPhone’a aplikacja PWA. Wersja 1.0 łączy Gruper JGP, Legislację MZ, Rachunek kosztów, kalkulator skutków wzrostu płac i pierwszy pilot Przetargów ze wspólną warstwą Data Hub.

## Zakres wersji 1.0

- osobna strona główna z modułami HospitalAPP,
- wyszukiwanie w odrębnych trybach: grupa JGP, rozpoznanie ICD-10 i procedura ICD-9,
- 702 grupy JGP oraz 35 060 pozycji ICD z oficjalnych załączników 1a i 9 do zarządzenia NFZ 46/2026/DSOZ z 30.04.2026 r.,
- czytelne ścieżki grupowania oraz rozwijane listy wymaganych procedur i rozpoznań,
- wartości punktowe, zakresy świadczeń, dni finansowane grupą i osobodzień ponad ryczałt,
- zanonimizowany profil referencyjny z kodem zakresu, produktem jednostkowym, okresem i średnią ceną punktu z API Umowy NFZ,
- profil własnej placówki zapisywany lokalnie,
- jawny wybór ceny: z dostępnego profilu umowy albo własna,
- osobny przełącznik współczynników dla każdej grupy JGP,
- rejestr publicznych reguł współczynników z warunkami, statusem weryfikacji i linkiem do źródła,
- podpowiedzi współczynników ograniczone do pasujących grup; żadna reguła nie jest stosowana automatycznie,
- dowolna liczba współczynników w jednej kalkulacji, z obsługą sumowania NFZ i mnożenia,
- aktywny kafelek Legislacja MZ z trwałą historią projektów i bezpośrednimi linkami do źródeł,
- tytuł, data publikacji lub aktualizacji, typ aktu, krótki status i oznaczenie „NOWE” dla każdego projektu,
- status ostatniej aktualizacji, liczba wszystkich projektów i liczba nowych pozycji,
- filtry „Tylko nowe” oraz „Tylko ze streszczeniem”,
- prywatne oznaczenia „Ważne”, „Przeczytane” i „Nie dotyczy mojego szpitala” zapisywane lokalnie,
- codzienne sprawdzanie źródła legislacja.gov.pl przez GitHub Actions bez OpenAI API,
- aktywną wyszukiwarkę pełnej treści standardu rachunku kosztów obejmującą § 1–10 i dziewięć załączników rozporządzenia MZ,
- 20 praktycznych pytań i odpowiedzi opracowanych na podstawie rozporządzenia i oficjalnego FAQ AOTMiT,
- bezpośrednie linki do webinarów, prezentacji, szablonów i nowego cyklu ABC #SRK,
- kalkulator skutków zmiany najniższych wynagrodzeń zasadniczych dla 10 ustawowych grup,
- domyślne podstawy GUS dla zmiany od 1 lipca 2026 r.: 8 181,72 zł → 8 903,56 zł,
- wyniki kalkulatora miesięczne, półroczne i roczne, z opcjonalnymi narzutami pracodawcy,
- wspólny manifest zbiorów Data Hub,
- wersjonowane schematy rekordów przetargowych i finansowych,
- niewidoczny dla użytkownika klient oddzielający ekrany od miejsca przechowywania danych,
- paczki JSON przygotowane do późniejszego przeniesienia z GitHuba do magazynu obiektowego lub API,
- automatyczną walidację paczek, identyfikatorów, linków i zakazu przechowywania surowych dokumentów,
- działający pilot wyszukiwarki przetargów dla hasła „sterylizacja” z linkami do oficjalnych kart e-Zamówienia,
- przygotowany kontrakt danych dla wyników finansowych eKRS,
- działanie offline po pierwszym pełnym uruchomieniu,
- zapisywanie ustawień i kalkulacji wyłącznie w pamięci urządzenia.

Publiczny katalog placówek w API NFZ nie oznacza automatycznie, że aplikacja zna ceny punktu każdej placówki. Publiczna wersja demonstracyjna nie pokazuje nazwy szpitala, kodu świadczeniodawcy ani numeru umowy. Cena jest prezentowana jako „z umowy” tylko dla przygotowanego profilu referencyjnego; w profilu własnym użytkownik podaje cenę samodzielnie.

## Źródła

- [zarządzenie NFZ 46/2026/DSOZ](https://www.nfz.gov.pl/zarzadzenia-prezesa/zarzadzenia-prezesa-nfz/zarzadzenie-nr-462026dsoz%2C7938.html),
- [API Umowy NFZ](https://api.nfz.gov.pl/app-umw-api/),
- [Informator o umowach NFZ – Małopolska](https://aplikacje.nfz.gov.pl/umowy/Provider/Search?Branch=06),
- [aktualna macierz łączenia współczynników NFZ](https://www.nfz.gov.pl/aktualnosci/aktualnosci-centrali/komunikat-dla-swiadczeniodawcow-i-tworcow-oprogramowania%2C8872.html),
- [projekty Ministerstwa Zdrowia w Rządowym Procesie Legislacyjnym](https://legislacja.gov.pl/lista?_typeId=1&title=&createDateFrom=&createDateTo=&applicantId=1&number=&_isUEAct=on&_isTKAct=on&_isActEstablishingNumber=on&_isSeparateMode=on&_isDU=on&_isNumerSejm=on#list),
- [wykaz prac legislacyjnych Ministra Zdrowia](https://www.gov.pl/web/zdrowie/wykaz-prac-legislacyjnych),
- [standard rachunku kosztów – Dz.U. 2020 poz. 2045](https://eli.gov.pl/eli/DU/2020/2045/ogl),
- [FAQ i materiały SRK AOTMiT](https://www.aotm.gov.pl/standard-rachunku-kosztow/wsparcie-aotmit-w-srk/faq/),
- [ustawa o najniższych wynagrodzeniach w podmiotach leczniczych](https://eli.gov.pl/eli/DU/2022/2139/ogl),
- [przeciętne wynagrodzenie w gospodarce narodowej w 2025 r. – GUS](https://stat.gov.pl/sygnalne/komunikaty-i-obwieszczenia/lista-komunikatow-i-obwieszczen/komunikat-w-sprawie-przecietnego-wynagrodzenia-w-gospodarce-narodowej-w-2025-r-%2C273%2C13.html).

HospitalAPP nie jest produktem NFZ. Dane źródłowe są oddzielone w interfejsie od założeń i obliczeń użytkownika.

## Kierunek produktu

HospitalAPP ma docelowo odpowiadać na pytanie „Jak zrobiły to inne szpitale?” na podstawie największego w Polsce, ujednoliconego zbioru publicznych danych przydatnych w zarządzaniu szpitalami.

Kolejność rozwoju:

1. regularny kolektor BZP i uzupełnianie wartości, wykonawców oraz typów dokumentów,
2. parser sprawozdań eKRS i pierwsze benchmarki wyników finansowych,
3. TED, AOTMiT oraz wybrane BIP szpitali,
4. kontrolowane streszczenia AI i odpowiedzi przekrojowe,
5. magazyn dużych paczek poza GitHubem,
6. Supabase w wersji 2.0 dla kont, synchronizacji i danych prywatnych.

Szczegóły techniczne i instrukcja rozwoju: [docs/data-hub-v1.md](docs/data-hub-v1.md).

## Uruchomienie lokalne

Uruchom serwer statyczny w katalogu projektu:

```bash
npm run serve
```

Następnie otwórz `http://localhost:8080`. Service worker i instalacja PWA wymagają hostingu przez HTTPS; wyjątkiem jest `localhost`.

## Aktualizacja danych JGP

Po pobraniu nowych oficjalnych załączników 1a i 9 uruchom:

```bash
python3 scripts/import_nfz_reference.py /ścieżka/do/Zalacznik1a.xlsx /ścieżka/do/Zalacznik9.xlsx
```

Importer sprawdza komplet grup i tworzy podzielone pliki `data/jgp-data-*.js` oraz `data/jgp-characteristics-*.js`, używane także offline.

Publiczny profil zakresu umowy można odświeżyć poleceniem:

```bash
python3 scripts/sync_nfz_contract.py
```

Skrypt korzysta z API Umowy NFZ v1.2. Do aplikacji zapisuje publiczną nazwę i kod świadczeniodawcy, lecz nie zapisuje adresu, NIP ani REGON. Inny profil można wskazać przez `--year`, `--branch`, `--provider-code`, `--provider-name`, `--product-code` i `--agreement-code`.

## Aktualizacja Legislacji MZ

Plik `data/mz-legislation.json` można sprawdzić ręcznie poleceniem:

```bash
npm run sync:legislation
```

Workflow `.github/workflows/update-mz-legislation.yml` uruchamia to samo zadanie codziennie i zapisuje zmianę tylko w pliku danych. Skrypt scala nowe pozycje z dotychczasowym rejestrem, dlatego raz wykryty projekt nie znika z aplikacji. Do repozytorium trafiają wyłącznie tytuł, metryka i link do projektu — bez treści załączników. Gdy RCL zwróci zero projektów, zadanie kończy się błędem i nie nadpisuje ostatniego poprawnego rejestru.

Pięciozdaniowe streszczenia mają osobny status `pending` albo `ready`. GitHub Actions nie wysyła dokumentów do OpenAI API; gotowe streszczenia mogą zostać uzupełnione w kontrolowanym procesie pracy z ChatGPT.

## Testy

```bash
npm test
```

Samą warstwę Data Hub można sprawdzić poleceniem:

```bash
npm run validate:data-hub
```
