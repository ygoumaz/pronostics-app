#!/bin/sh
sqlite3 /data/prod.db "
UPDATE Match SET awayTeamCode='PAR' WHERE matchNumber=74;
UPDATE Match SET awayTeamCode='SWE' WHERE matchNumber=77;
UPDATE Match SET awayTeamCode='ECU' WHERE matchNumber=79;
UPDATE Match SET awayTeamCode='COD' WHERE matchNumber=80;
UPDATE Match SET awayTeamCode='BIH' WHERE matchNumber=81;
UPDATE Match SET awayTeamCode='SEN' WHERE matchNumber=82;
UPDATE Match SET awayTeamCode='ALG' WHERE matchNumber=85;
UPDATE Match SET awayTeamCode='GHA' WHERE matchNumber=87;
SELECT matchNumber, awayTeamCode FROM Match WHERE matchNumber IN (74,77,79,80,81,82,85,87);
"
