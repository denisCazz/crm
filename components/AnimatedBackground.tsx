"use client";
import React from 'react';

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Cerchio 1 - Grande, lento */}
      <div 
        className="absolute rounded-full bg-blue-500/30 animate-float-slow border-2 border-blue-400/50"
        style={{
          width: '200px',
          height: '200px',
          top: '10%',
          left: '10%',
          animationDelay: '0s',
        }}
      />
      
      {/* Cerchio 2 - Medio, velocità media */}
      <div 
        className="absolute rounded-full bg-indigo-500/25 animate-float-medium border-2 border-indigo-400/50"
        style={{
          width: '150px',
          height: '150px',
          top: '60%',
          right: '10%',
          animationDelay: '2s',
        }}
      />
      
      {/* Cerchio 3 - Piccolo, veloce */}
      <div 
        className="absolute rounded-full bg-purple-500/35 animate-float-fast border-2 border-purple-400/50"
        style={{
          width: '100px',
          height: '100px',
          top: '20%',
          right: '30%',
          animationDelay: '1s',
        }}
      />
      
      {/* Cerchio 4 - Grande, direzione opposta */}
      <div 
        className="absolute rounded-full bg-cyan-500/25 animate-float-reverse border-2 border-cyan-400/50"
        style={{
          width: '180px',
          height: '180px',
          bottom: '20%',
          left: '20%',
          animationDelay: '3s',
        }}
      />
      
      {/* Cerchio 5 - Piccolo, posizione centrale */}
      <div 
        className="absolute rounded-full bg-teal-500/30 animate-float-medium border-2 border-teal-400/50"
        style={{
          width: '80px',
          height: '80px',
          top: '40%',
          left: '15%',
          animationDelay: '4s',
        }}
      />
    </div>
  );
}