#!/bin/bash

_alarm() {
  ( \speaker-test --frequency $1 --test sine )&
  pid=$!
  \sleep 0.${2}s
  \kill -9 $pid
}

don=false;

until $don;
do
  nc -w 1 gitlabdev1.as12.qc.labs247.id 80;
  if [[ $? == 0 ]]
  then
    notify-send -t 200 -i /usr/share/icons/gnome/48x48/status/weather-clear.png -u critical "gitlabdev1.as12.qc.labs247.id ready" "Gitlab di gitlabdev1.as12.qc.labs247.id port 80 sudah siap dipakai";
    _alarm 1000 200;
    don=true;
  fi
done
