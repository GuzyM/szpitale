# HospitalAPP

HospitalAPP to instalowalna na ekranie początkowym iPhone’a aplikacja PWA. Wersja 0.6 zawiera mobilny Gruper JGP oraz moduł Legislacja MZ.

## Zakres wersji 0.6

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
- aktywny kafelek Legislacja MZ z oficjalnymi linkami i ręcznym odświeżaniem,
- codzienne sprawdzanie źródła legislacja.gov.pl przez GitHub Actions,
- działanie offline po pierwszym pełnym uruchomieniu,
- zapisywanie ustawień i kalkulacji wyłącznie w pamięci urządzenia.

Publiczny katalog placówek w API NFZ nie oznacza automatycznie, że aplikacja zna ceny punktu każdej placówki. Publiczna wersja demonstracyjna nie pokazuje nazwy szpitala, kodu świadczeniodawcy ani numeru umowy. Cena jest prezentowana jako „z umowy” tylko dla przygotowanego profilu referencyjnego; w profilu własnym użytkownik podaje cenę samodzielnie.

## Źródła

- [zarządzenie NFZ 46/2026/DSOZ](https://www.nfz.gov.pl/zarzadzenia-prezesa/zarzadzenia-prezesa-nfz/zarzadzenie-nr-462026dsoz%2C7938.html),
- [API Umowy NFZ](https://api.nfz.gov.pl/app-umw-api/),
- [Informator o umowach NFZ – Małopolska](https://aplikacje.nfz.gov.pl/umowy/Provider/Search?Branch=06),
- [aktualna macierz łączenia współczynników NFZ](https://www.nfz.gov.pl/aktualnosci/aktualnosci-centrali/komunikat-dla-swiadczeniodawcow-i-tworcow-oprogramowania%2C8872.html).
- [projekty Ministerstwa Zdrowia w Rządowym Procesie Legislacyjnym](https://legislacja.gov.pl/lista?_typeId=1&title=&createDateFrom=&createDateTo=&applicantId=1&number=&_isUEAct=on&_isTKAct=on&_isActEstablishingNumber=on&_isSeparateMode=on&_isDU=on&_isNumerSejm=on#list),
- [wykaz prac legislacyjnych Ministra Zdrowia](https://www.gov.pl/web/zdrowie/wykaz-prac-legislacyjnych).

HospitalAPP nie jest produktem NFZ. Dane źródłowe są oddzielone w interfejsie od założeń i obliczeń użytkownika.

## Kierunek produktu

HospitalAPP ma docelowo skupiać proste narzędzia dla osób zarządzających szpitalem, oparte na publicznych danych i jednoznacznie opisanych założeniach. Kolejność rozwoju:

1. dopracowanie Grupera JGP,
2. kalkulator wynagrodzeń medycznych: stawki godzinowe, nocne, dyżurowe i nadgodziny, netto, brutto, pełny koszt pracodawcy oraz porównanie umowy o pracę z kontraktem,
3. analiza wyników i rachunek kosztów,
4. programy naprawcze,
5. dalsza rozbudowa monitora legislacji i komunikatów branżowych.

Kafelki przyszłych modułów są wyłącznie zapowiedzią. Nie prezentują obliczeń, dopóki reguły prawne, podatkowe i źródła danych nie zostaną zweryfikowane oraz opatrzone datą obowiązywania.

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

Workflow `.github/workflows/update-mz-legislation.yml` uruchamia to samo zadanie codziennie i zapisuje zmianę tylko w pliku danych. Jeżeli strona źródłowa nie udostępni kart projektów w HTML, skrypt zachowuje ostatnią poprawną listę i odświeża status oficjalnych źródeł zamiast kasować dane.

## Testy

```bash
npm test
```
